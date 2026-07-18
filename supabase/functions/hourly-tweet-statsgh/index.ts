// Hourly StatsGH tweet scheduler.
// Cron: every hour on the :00. Posts at most one tweet per invocation.
// Flow:
//  1. Find a published article from the last 7 days that has NOT been tweeted.
//  2. If none, fall back to the most recent article from the last 24h and
//     generate a fresh variant tweet.
//  3. Generate the tweet via callGateway (gemini-2.5-flash-lite, max_tokens 280,
//     temperature 0.2).
//  4. Delegate posting to the existing tweet-article function (X API v2 + OAuth).
//  5. Mark the article as tweeted via twitter_post="POSTED:<tweet_id>|<text>"
//     (same convention as tweet-article) and log every attempt to
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
- If no usable stat, output SKIP`;

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
      {
        role: "user",
        content: `Title: ${article.title}\n\nArticle: ${source}`,
      },
    ],
    max_tokens: 280,
    temperature: 0.2,
  });
  const cleaned = (content || "").trim().replace(/^["']|["']$/g, "");
  if (!cleaned || cleaned.toUpperCase() === "SKIP") return null;
  if (cleaned.length > 280) return cleaned.slice(0, 277) + "...";
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 24h dedup: which article ids have been logged (posted) in the last 24h
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

    // 1. Find last-7d article that has NOT been tweeted yet.
    const { data: untweeted } = await supabase
      .from("articles")
      .select("id, title, summary, body, slug, category_slug, twitter_post")
      .eq("is_published", true)
      .gte("published_at", cutoff7d)
      .or("twitter_post.is.null,twitter_post.eq.")
      .order("published_at", { ascending: false })
      .limit(10);

    let article = (untweeted || []).find(
      (a: { id: string; twitter_post: string | null }) =>
        !recentlyPostedIds.has(a.id) &&
        !(a.twitter_post || "").startsWith("POSTED:"),
    );
    let variantMode = false;

    // 2. Fallback: most recent last-24h article, generate a fresh variant.
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
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
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

    // 4. Post via X API (OAuth 1.0a). Reuse the credentials the tweet-article
    //    function already uses; delegate to it so the OAuth code stays in one
    //    place.
    const invokeResp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/tweet-article`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          articleId: article.id,
          // tweet-article uses article.twitter_post when set; write our
          // freshly-generated variant so it posts exactly what we produced.
          overrideText: tweetText,
        }),
      },
    );
    const invokeJson: {
      success?: boolean;
      tweetId?: string;
      tweetText?: string;
      skipped?: boolean;
      message?: string;
      error?: string;
      details?: unknown;
    } = await invokeResp.json().catch(() => ({}));

    if (!invokeResp.ok || invokeJson.error) {
      await logAttempt(supabase, {
        article_id: article.id,
        tweet_text: tweetText,
        status: "error",
        reason: `tweet-article ${invokeResp.status}: ${
          invokeJson.error || JSON.stringify(invokeJson.details || {})
        }`,
      });
      return new Response(
        JSON.stringify({ success: false, error: invokeJson.error, invokeJson }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (invokeJson.skipped) {
      await logAttempt(supabase, {
        article_id: article.id,
        tweet_text: tweetText,
        status: "skipped",
        reason: `tweet-article skipped: ${invokeJson.message || "unknown"}`,
      });
      return new Response(JSON.stringify({ success: true, ...invokeJson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tweetId = invokeJson.tweetId ?? null;
    const finalText = invokeJson.tweetText || tweetText;

    // 5. Ensure article is marked tweeted. tweet-article already writes
    //    twitter_post="POSTED:<id>|<text>", but do a defensive upsert in case
    //    the field is still empty (e.g. overrideText path).
    await supabase
      .from("articles")
      .update({
        twitter_post: `POSTED:${tweetId ?? "unknown"}|${finalText}`,
      })
      .eq("id", article.id);

    await logAttempt(supabase, {
      article_id: article.id,
      tweet_text: finalText,
      tweet_id: tweetId,
      status: "posted",
      reason: variantMode ? "variant_fallback" : "fresh",
    });

    return new Response(
      JSON.stringify({
        success: true,
        articleId: article.id,
        tweetId,
        tweetText: finalText,
        variantMode,
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
