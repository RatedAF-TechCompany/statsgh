import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Percent-encode per RFC 3986
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createOAuthSignature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const signatureBase = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  // HMAC-SHA1 using Web Crypto API
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureBase));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
    const CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

    if (!CONSUMER_KEY || !CONSUMER_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
      throw new Error("Twitter API credentials not configured");
    }

    // Auth check - allow service role key OR authenticated admin/editor
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRole = token === serviceRoleKey;

    // Use service role client for DB access when called internally
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      isServiceRole ? serviceRoleKey! : Deno.env.get("SUPABASE_ANON_KEY")!,
      isServiceRole ? {} : { global: { headers: { Authorization: authHeader } } }
    );

    if (!isServiceRole) {
      // Validate user auth
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.claims.sub;
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!roleData || !["admin", "editor"].includes(roleData.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: admin/editor only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { articleId } = await req.json();
    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("id, title, slug, category_slug, twitter_post, summary")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Skip if already tweeted
    if (article.twitter_post?.startsWith("POSTED:")) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Already tweeted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RATE LIMIT: max 1 tweet every 30 minutes ──
    const cutoff30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentPosted } = await supabase
      .from("articles")
      .select("id, twitter_post")
      .like("twitter_post", "POSTED:%")
      .gte("published_at", cutoff30m)
      .neq("id", articleId)
      .limit(1);

    if (recentPosted && recentPosted.length > 0) {
      console.log(`Tweet rate-limited: another tweet was posted within the last 30 minutes (article ${recentPosted[0].id})`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Rate limited: max 1 tweet every 30 minutes" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PRE-TWEET DEDUP: check if a very similar tweet was posted in the last 24h ──
    const STOP_WORDS = new Set(["the","a","an","in","on","at","to","for","of","and","or","is","are","was","were","has","have","had","been","be","will","with","by","from","as","its","it","that","this","not","but","than","also","into","over","per","no","up","out","new","said"]);
    function tweetKeywords(text: string): Set<string> {
      return new Set(
        text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)
          .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );
    }

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTweeted } = await supabase
      .from("articles")
      .select("id, title, twitter_post")
      .like("twitter_post", "POSTED:%")
      .gte("published_at", cutoff24h)
      .neq("id", articleId)
      .limit(50);

    // Build tweet text: use twitter_post field if available, else auto-generate
    let tweetText = article.twitter_post || article.title;

    // Strip any URLs from the tweet text
    tweetText = tweetText.replace(/https?:\/\/[^\s]+/g, '').replace(/www\.[^\s]+/g, '').trim();

    // Check keyword overlap against recently tweeted articles
    const candidateKw = tweetKeywords(tweetText);
    if (recentTweeted && recentTweeted.length > 0) {
      for (const prev of recentTweeted) {
        // Extract the actual tweet text from "POSTED:id|text"
        const prevText = prev.twitter_post?.replace(/^POSTED:[^|]*\|/, "") || prev.title;
        const prevKw = tweetKeywords(prevText);
        let shared = 0;
        const sharedWords: string[] = [];
        for (const w of candidateKw) {
          if (prevKw.has(w)) { shared++; sharedWords.push(w); }
        }
        if (shared >= 4) {
          console.log(`Tweet dedup: skipping "${tweetText.substring(0, 60)}..." — ${shared} keywords overlap [${sharedWords.join(", ")}] with already-tweeted article ${prev.id}`);
          // Mark as skipped so it doesn't retry
          await supabase
            .from("articles")
            .update({ twitter_post: `DEDUP_SKIP:${prev.id}|${tweetText}` })
            .eq("id", articleId);
          return new Response(
            JSON.stringify({ success: true, skipped: true, message: `Dedup: ${shared} keywords overlap with recently tweeted article` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ── EVERY 6TH TWEET: append article URL ──
    // Count all successful tweets (no time limit, just the cycle of 5)
    const { count: postedCount } = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .like("twitter_post", "POSTED:%");

    const tweetNumber = (postedCount || 0) + 1; // this will be the Nth tweet
    const isUrlTweet = tweetNumber % 6 === 0;

    if (isUrlTweet) {
      const articleUrl = `https://statsgh.com/${article.category_slug}/${article.slug}/`;
      // Append URL, ensure total fits in 280 chars (URLs use ~23 chars via t.co)
      const maxTextLen = 160 - 1; // keep text portion to 160 chars max
      if (tweetText.length > maxTextLen) {
        // Trim to last full stop or space to avoid mid-word cutoff
        let trimmed = tweetText.substring(0, maxTextLen);
        const lastStop = trimmed.lastIndexOf('.');
        if (lastStop > maxTextLen * 0.5) {
          trimmed = trimmed.substring(0, lastStop + 1);
        }
        tweetText = trimmed;
      }
      tweetText = `${tweetText} ${articleUrl}`;
    } else {
      // Enforce 160 char limit without truncation dots
      if (tweetText.length > 160) {
        let trimmed = tweetText.substring(0, 160);
        const lastStop = trimmed.lastIndexOf('.');
        if (lastStop > 80) {
          trimmed = trimmed.substring(0, lastStop + 1);
        } else {
          // Fall back to last space to avoid mid-word cutoff
          const lastSpace = trimmed.lastIndexOf(' ');
          if (lastSpace > 80) {
            trimmed = trimmed.substring(0, lastSpace) + '.';
          }
        }
        tweetText = trimmed;
      }
    }

    // Post tweet using X API v2
    const tweetUrl = "https://api.x.com/2/tweets";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_token: ACCESS_TOKEN,
      oauth_version: "1.0",
    };

    // IMPORTANT: Do NOT include POST body parameters in OAuth signature for JSON requests
    const signature = await createOAuthSignature(
      "POST",
      tweetUrl,
      oauthParams,
      CONSUMER_SECRET,
      ACCESS_TOKEN_SECRET
    );

    const authHeaderValue =
      `OAuth ` +
      Object.entries({ ...oauthParams, oauth_signature: signature })
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
        .join(", ");

    const tweetResponse = await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: authHeaderValue,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweetText }),
    });

    const tweetResult = await tweetResponse.json();

    if (!tweetResponse.ok) {
      console.error("Twitter API error:", tweetResponse.status, JSON.stringify(tweetResult));
      return new Response(
        JSON.stringify({
          error: "Failed to post tweet",
          details: tweetResult,
          status: tweetResponse.status,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update article twitter_post field with the posted text and tweet ID
    const tweetId = tweetResult?.data?.id;
    await supabase
      .from("articles")
      .update({
        twitter_post: `POSTED:${tweetId}|${tweetText}`,
      })
      .eq("id", articleId);

    return new Response(
      JSON.stringify({
        success: true,
        tweetId,
        tweetText,
        tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("tweet-article error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
