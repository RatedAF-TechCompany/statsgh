// Stage 3 of the unified StatsGH Twitter pipeline.
// Cron: every hour at :05.
// Pops the oldest un-posted tweet from public.tweet_queue, posts to X, logs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadTwitterCredentials, postTweet } from "../_shared/twitter-oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const creds = loadTwitterCredentials();
  if (!creds) {
    return new Response(
      JSON.stringify({ error: "Twitter API credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { data: rows, error } = await supabase
      .from("tweet_queue")
      .select("id, article_id, tweet_text, url")
      .eq("posted", false)
      .is("halt_reason", null)
      .order("generated_at", { ascending: true })
      .limit(1);
    if (error) throw error;

    const next = rows?.[0];
    if (!next) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "queue_empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure URL is present in the tweet.
    let text = next.tweet_text as string;
    if (next.url && !text.includes(next.url)) {
      const marker = ` [Read: ${next.url}]`;
      const budget = 280 - marker.length;
      const head = text.length > budget ? text.slice(0, budget - 1).trimEnd() : text;
      text = head + marker;
    }
    if (text.length > 280) text = text.slice(0, 277) + "...";

    const result = await postTweet(text, creds);

    if (!result.ok) {
      const rawStr = JSON.stringify(result.raw).slice(0, 500);
      const errMsg = `x_api_${result.status}: ${rawStr}`;

      // 402 credits / 429 rate limit — mark halt so this row is skipped by future ticks.
      if (result.status === 402 || result.status === 429) {
        await supabase
          .from("tweet_queue")
          .update({ halt_reason: errMsg.slice(0, 500) })
          .eq("id", next.id);
      }

      console.error("tweet-hourly-poster X error:", errMsg);
      return new Response(
        JSON.stringify({ success: false, error: errMsg, articleId: next.article_id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const postedAt = new Date().toISOString();
    await supabase
      .from("tweet_queue")
      .update({ posted: true, posted_at: postedAt, twitter_id: result.tweetId || null })
      .eq("id", next.id);

    await supabase.from("tweet_schedule_log").insert({
      article_id: next.article_id,
      tweet_text: text,
      tweet_id: result.tweetId || null,
      status: "posted",
    });

    return new Response(
      JSON.stringify({
        success: true,
        articleId: next.article_id,
        tweetId: result.tweetId,
        tweetUrl: result.tweetId ? `https://x.com/i/web/status/${result.tweetId}` : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tweet-hourly-poster error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
