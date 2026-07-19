// Hourly poster that drains public.daily_tweet_queue.
// Cron: every hour at :05 (06:05 .. 23:05 UTC).
// Pops one unposted tweet (oldest first) and posts it to X via OAuth 1.0a.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
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
  const base = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
  const CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
  if (!CONSUMER_KEY || !CONSUMER_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    return new Response(JSON.stringify({ error: "Twitter API credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Pop oldest unposted, unscheduled tweet.
    const { data: rows } = await supabase
      .from("daily_tweet_queue")
      .select("id, article_id, tweet_text, url")
      .is("posted_at", null)
      .is("scheduled_at", null)
      .order("generated_at", { ascending: true })
      .limit(1);
    const next = rows?.[0];
    if (!next) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "queue_empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Claim it immediately (scheduled_at = now) to prevent double-post races.
    const nowIso = new Date().toISOString();
    await supabase.from("daily_tweet_queue").update({ scheduled_at: nowIso }).eq("id", next.id);

    // Post to X.
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

    const resp = await fetch(tweetUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ text: next.tweet_text }),
    });
    const json = await resp.json();

    if (!resp.ok) {
      const errStr = `X API ${resp.status}: ${JSON.stringify(json)}`.slice(0, 500);
      console.error("hourly-tweet-poster X error:", errStr);
      // Release the claim so it can be retried on the next tick.
      await supabase.from("daily_tweet_queue").update({ scheduled_at: null }).eq("id", next.id);
      return new Response(JSON.stringify({ success: false, error: errStr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tweetId: string | null = json?.data?.id ?? null;
    await supabase
      .from("daily_tweet_queue")
      .update({ posted_at: new Date().toISOString(), tweet_id: tweetId })
      .eq("id", next.id);

    // Mirror onto the article for legacy consumers.
    await supabase
      .from("articles")
      .update({ twitter_post: `POSTED:${tweetId ?? "unknown"}|${next.tweet_text}` })
      .eq("id", next.article_id);

    return new Response(
      JSON.stringify({
        success: true,
        articleId: next.article_id,
        tweetId,
        tweetUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("hourly-tweet-poster error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
