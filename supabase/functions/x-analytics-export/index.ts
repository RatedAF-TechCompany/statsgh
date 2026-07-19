// One-off analytics exporter for the StatsGH X account.
// Pulls the authenticated user's timeline via v2, then returns:
//   top50_5y   → top 50 tweets by (likes + retweets) from the last 5 years
//   last12mo   → all tweets from the last 12 months, sorted desc by date
//
// Uses the same OAuth 1.0a credentials as tweet-article / hourly-tweet-statsgh.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function nonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

async function sign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): Promise<string> {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const base = `${method}&${percentEncode(url)}&${percentEncode(sorted)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function oauthGet(
  url: string,
  query: Record<string, string>,
  creds: {
    consumerKey: string; consumerSecret: string;
    accessToken: string; accessTokenSecret: string;
  },
): Promise<Response> {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const allParams = { ...oauth, ...query };
  const signature = await sign(
    "GET", url, allParams, creds.consumerSecret, creds.accessTokenSecret,
  );
  oauth.oauth_signature = signature;
  const authHeader = "OAuth " + Object.entries(oauth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");
  const qs = new URLSearchParams(query).toString();
  return fetch(`${url}?${qs}`, { headers: { Authorization: authHeader } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const creds = {
    consumerKey: Deno.env.get("TWITTER_CONSUMER_KEY") || "",
    consumerSecret: Deno.env.get("TWITTER_CONSUMER_SECRET") || "",
    accessToken: Deno.env.get("TWITTER_ACCESS_TOKEN") || "",
    accessTokenSecret: Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET") || "",
  };
  if (!creds.consumerKey || !creds.consumerSecret || !creds.accessToken || !creds.accessTokenSecret) {
    return new Response(JSON.stringify({ error: "Twitter creds missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Who am I?
    const meRes = await oauthGet("https://api.x.com/2/users/me", {}, creds);
    const meText = await meRes.text();
    if (!meRes.ok) {
      return new Response(JSON.stringify({ step: "users/me", status: meRes.status, body: meText }), {
        status: meRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const me = JSON.parse(meText);
    const userId = me?.data?.id;
    const username = me?.data?.username;
    if (!userId) {
      return new Response(JSON.stringify({ error: "no user id", raw: meText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Paginate timeline (v2 max ~3200 tweets).
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const twelveMoAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const startTime = fiveYearsAgo.toISOString().replace(/\.\d{3}Z$/, "Z");

    const collected: Array<{
      id: string; text: string; created_at: string;
      like_count: number; retweet_count: number; reply_count: number; quote_count: number;
      impression_count: number | null;
    }> = [];

    let nextToken: string | undefined;
    let pages = 0;
    const maxPages = 40; // 40 * 100 = 4000 upper bound (API caps ~3200)

    while (pages < maxPages) {
      const q: Record<string, string> = {
        max_results: "100",
        "tweet.fields": "created_at,public_metrics,non_public_metrics,organic_metrics",
        exclude: "retweets,replies",
        start_time: startTime,
      };
      if (nextToken) q.pagination_token = nextToken;

      const res = await oauthGet(
        `https://api.x.com/2/users/${userId}/tweets`,
        q,
        creds,
      );
      const text = await res.text();
      if (!res.ok) {
        // If organic/non_public metrics rejected, retry with public_metrics only.
        if (res.status === 400 && text.includes("metrics")) {
          const q2 = { ...q, "tweet.fields": "created_at,public_metrics" };
          const res2 = await oauthGet(
            `https://api.x.com/2/users/${userId}/tweets`, q2, creds,
          );
          const text2 = await res2.text();
          if (!res2.ok) {
            return new Response(JSON.stringify({ step: "timeline", status: res2.status, body: text2, page: pages }), {
              status: res2.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const parsed = JSON.parse(text2);
          for (const t of parsed.data || []) {
            collected.push({
              id: t.id, text: t.text, created_at: t.created_at,
              like_count: t.public_metrics?.like_count ?? 0,
              retweet_count: t.public_metrics?.retweet_count ?? 0,
              reply_count: t.public_metrics?.reply_count ?? 0,
              quote_count: t.public_metrics?.quote_count ?? 0,
              impression_count: t.public_metrics?.impression_count ?? null,
            });
          }
          nextToken = parsed.meta?.next_token;
        } else {
          return new Response(JSON.stringify({ step: "timeline", status: res.status, body: text, page: pages }), {
            status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const parsed = JSON.parse(text);
        for (const t of parsed.data || []) {
          const pm = t.public_metrics || {};
          const om = t.organic_metrics || {};
          const nm = t.non_public_metrics || {};
          collected.push({
            id: t.id, text: t.text, created_at: t.created_at,
            like_count: om.like_count ?? pm.like_count ?? 0,
            retweet_count: om.retweet_count ?? pm.retweet_count ?? 0,
            reply_count: om.reply_count ?? pm.reply_count ?? 0,
            quote_count: om.quote_count ?? pm.quote_count ?? 0,
            impression_count: om.impression_count ?? nm.impression_count ?? pm.impression_count ?? null,
          });
        }
        nextToken = parsed.meta?.next_token;
      }

      pages += 1;
      if (!nextToken) break;
    }

    // 3. Derive datasets.
    const withEng = collected.map((t) => {
      const total = t.like_count + t.retweet_count;
      const engagement_rate = t.impression_count && t.impression_count > 0
        ? +(((t.like_count + t.retweet_count + t.reply_count + t.quote_count) / t.impression_count) * 100).toFixed(3)
        : null;
      return { ...t, total_engagement: total, engagement_rate };
    });

    const top50_5y = [...withEng]
      .sort((a, b) => b.total_engagement - a.total_engagement)
      .slice(0, 50);

    const last12mo = withEng
      .filter((t) => new Date(t.created_at) >= twelveMoAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(
      JSON.stringify({
        account: { user_id: userId, username },
        collected_count: collected.length,
        pages_fetched: pages,
        top50_5y,
        last12mo,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
