// Hourly StatsGH tweet scheduler.
// Cron: every hour on the :00. Posts at most one tweet per invocation.
// Independent of tweet-article (which has a 2/day cap + 180-min gap that would
// block hourly cadence).
//
// Flow:
//  1. Find a published article from the last 7 days that has NOT been tweeted.
//  2. If none, fall back to the most recent article from the last 24h and
//     generate a fresh variant tweet.
//  3. Generate the tweet via callGateway (gemini-2.5-flash-lite, max_tokens 280,
//     temperature 0.2).
//  4. Post to the X API v2 using the StatsGH OAuth 1.0a credentials.
//  5. Mark the article as tweeted via twitter_post="POSTED:<tweet_id>|<text>"
//     (same convention as tweet-article) and log the attempt to
//     public.tweet_schedule_log.
//  6. On GatewayHaltError, log the halt reason and exit without retry.
//  7. Never tweet the same article_id more than once per 24h.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGateway, GatewayHaltError } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are StatsGH, Ghana's premier data journalism account. Rewrite the article into ONE tweet.

RULES:
- Present perfect tense in first 60 chars: [Subject] has/have [past participle] ...
- Contains at least one specific number, %, or currency figure from the article
- Max 240 characters, ends with a period
- No emojis, hashtags, links, or dashes
- Sentence case
- Use "GHS" for cedi
- If no usable stat, output the single word SKIP`;

// ── OAuth 1.0a helpers (mirror of tweet-article) ─────────────────────────────

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function generateNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function createOAuthSignature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): Promise<string> {
  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const signatureBase = `${method}&${percentEncode(url)}&${
    percentEncode(sortedParams)
  }`;
  const signingKey = `${percentEncode(consumerSecret)}&${
    percentEncode(tokenSecret)
  }`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signatureBase),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── Log helper ───────────────────────────────────────────────────────────────

async function logAttempt(
  supabase: ReturnType<typeof createClient>,
  entry: {
    article_id: string | null;
    tweet_text: string | null;
    tweet_id?: string | null;
    status: string;
    reason?: string | null;
  },
) {
  try {
    await supabase.from("tweet_schedule_log").insert(entry);
  } catch (e) {
    console.error("Failed to write tweet_schedule_log:", e);
  }
}

// ── AI tweet generator ───────────────────────────────────────────────────────

async function generateTweet(article: {
  title: string;
  summary: string | null;
  body: string | null;
}): Promise<string | null> {
  const source =
    (article.summary && article.summary.length > 40
      ? article.summary
      : article.body?.slice(0, 1200)) || article.title;
  const { content } = await callGateway({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Title: ${article.title}\n\nArticle: ${source}` },
    ],
    max_tokens: 280,
    temperature: 0.2,
  });
  let cleaned = (content || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.toUpperCase() === "SKIP") return null;
  if (cleaned.length > 280) cleaned = cleaned.slice(0, 277) + "...";
  return cleaned;
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
  const CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
  if (
    !CONSUMER_KEY || !CONSUMER_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET
  ) {
    return new Response(
      JSON.stringify({ error: "Twitter API credentials not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const now = Date.now();
  const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 24h dedup: article ids already posted in the last 24h.
    const { data: recentLog } = await supabase
      .from("tweet_schedule_log")
      .select("article_id, status")
      .gte("created_at", cutoff24h)
      .eq("status", "posted");
    const recentlyPostedIds = new Set(
      (recentLog || [])
        .map((r: { article_id: string | null }) => r.article_id)
        .filter(Boolean) as string[],
    );

    // 1. Untweeted article from last 7d.
    const { data: untweeted } = await supabase
      .from("articles")
      .select("id, title, summary, body, slug, category_slug, twitter_post")
      .eq("is_published", true)
      .gte("published_at", cutoff7d)
      .or("twitter_post.is.null,twitter_post.eq.")
      .order("published_at", { ascending: false })
      .limit(20);

    let article = (untweeted || []).find(
      (a: { id: string; twitter_post: string | null }) =>
        !recentlyPostedIds.has(a.id) &&
        !(a.twitter_post || "").startsWith("POSTED:"),
    );
    let variantMode = false;

    // 2. Fallback: freshest article in last 24h (generate a variant).
    if (!article) {
      const { data: recent } = await supabase
        .from("articles")
        .select("id, title, summary, body, slug, category_slug, twitter_post")
        .eq("is_published", true)
        .gte("published_at", cutoff24h)
        .order("published_at", { ascending: false })
        .limit(10);
      article = (recent || []).find(
        (a: { id: string }) => !recentlyPostedIds.has(a.id),
      );
      variantMode = !!article;
    }

    if (!article) {
      await logAttempt(supabase, {
        article_id: null,
        tweet_text: null,
        status: "skipped",
        reason: "no eligible article in 7d/24h window",
      });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no article" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Generate tweet via callGateway.
    let tweetText: string | null = null;
    try {
      tweetText = await generateTweet(article);
    } catch (err) {
      if (err instanceof GatewayHaltError) {
        await logAttempt(supabase, {
          article_id: article.id,
          tweet_text: null,
          status: "halted",
          reason: `${err.reason} (${err.status})`,
        });
        return new Response(
          JSON.stringify({
            success: false,
            halted: true,
            reason: err.reason,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw err;
    }

    if (!tweetText) {
      await logAttempt(supabase, {
        article_id: article.id,
        tweet_text: null,
        status: "skipped",
        reason: "AI returned SKIP or empty output",
      });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "SKIP" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Post to X API v2 with OAuth 1.0a.
    const tweetUrl = "https://api.x.com/2/tweets";
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: ACCESS_TOKEN,
      oauth_version: "1.0",
    };
    const signature = await createOAuthSignature(
      "POST",
      tweetUrl,
      oauthParams,
      CONSUMER_SECRET,
      ACCESS_TOKEN_SECRET,
    );
    const authHeader = "OAuth " +
      Object.entries({ ...oauthParams, oauth_signature: signature })
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
        .join(", ");

    const tweetResp = await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweetText }),
    });
    const tweetJson = await tweetResp.json();

    if (!tweetResp.ok) {
      const errStr = `X API ${tweetResp.status}: ${JSON.stringify(tweetJson)}`
        .slice(0, 500);
      console.error("hourly-tweet-statsgh X error:", errStr);
      await logAttempt(supabase, {
        article_id: article.id,
        tweet_text: tweetText,
        status: "error",
        reason: errStr,
      });
      return new Response(
        JSON.stringify({ success: false, error: errStr }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tweetId: string | null = tweetJson?.data?.id ?? null;

    // 5. Mark article tweeted + log.
    await supabase
      .from("articles")
      .update({
        twitter_post: `POSTED:${tweetId ?? "unknown"}|${tweetText}`,
      })
      .eq("id", article.id);

    await supabase
      .from("tweet_scheduler_state")
      .update({ last_posted_at: new Date().toISOString() })
      .eq("id", 1);

    await logAttempt(supabase, {
      article_id: article.id,
      tweet_text: tweetText,
      tweet_id: tweetId,
      status: "posted",
      reason: variantMode ? "variant_fallback" : "fresh",
    });

    return new Response(
      JSON.stringify({
        success: true,
        articleId: article.id,
        tweetId,
        tweetText,
        variantMode,
        tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("hourly-tweet-statsgh error:", msg);
    await logAttempt(supabase, {
      article_id: null,
      tweet_text: null,
      status: "error",
      reason: msg,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
