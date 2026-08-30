// STATSGH SINGLE TWEET PIPELINE — Stage 3 (posting only).
// Cron: hourly at :05. Pops the oldest queued tweet, re-runs the full final
// validation, then posts to X. Never truncates, never repairs: an invalid row
// is halted and logged instead of being posted.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadTwitterCredentials, postTweet } from "../_shared/twitter-oauth.ts";
import {
  extractSubstantiveNumbers,
  validateFinalTweet,
  articleText,
} from "../_shared/statistical-validator.ts";
import { finalTweetValidator } from "../_shared/editorial-gate.ts";

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
    return new Response(JSON.stringify({ error: "Twitter API credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // RULE 11: release abandoned claims, then claim exactly one row atomically.
    await supabase.rpc("release_stale_tweet_claims");
    const worker = `poster-${crypto.randomUUID().slice(0, 8)}`;
    const { data: claimed, error } = await supabase.rpc("claim_next_tweet", { p_worker: worker });
    if (error) throw error;
    const rows = (Array.isArray(claimed) ? claimed : claimed ? [claimed] : []) as any[];

    for (const row of rows || []) {
      const { data: article } = await supabase
        .from("articles")
        .select("id, title, summary, body, slug, category_slug")
        .eq("id", row.article_id)
        .maybeSingle();

      if (!article) {
        await supabase.from("tweet_queue").update({ halt_reason: "article_missing" }).eq("id", row.id);
        await supabase.from("tweet_decisions").insert({
          article_id: row.article_id, headline: row.headline, canonical_url: row.url,
          tweet_text: row.tweet_text, status: "REJECT_VALIDATION_FAILED",
          reason: "source article no longer exists",
        });
        continue;
      }

      // RULES 1-4 + 10: the shared editorial gate runs again immediately
      // before posting. A story that should never have been published can
      // never be tweeted.
      const preGate = finalTweetValidator(article as any, { fingerprint: row.event_fingerprint || undefined });
      if (!preGate.ok) {
        await supabase.from("tweet_queue").update({ halt_reason: preGate.code }).eq("id", row.id);
        await supabase.from("tweet_decisions").insert({
          article_id: row.article_id, headline: row.headline, canonical_url: row.url,
          event_fingerprint: row.event_fingerprint, tweet_text: row.tweet_text,
          status: preGate.code, reason: `pre-post gate: ${preGate.reason}`,
        });
        continue;
      }

      if (row.event_fingerprint) {
        const { data: ev } = await supabase
          .from("news_events")
          .select("id, tweeted")
          .eq("fingerprint", row.event_fingerprint)
          .maybeSingle();
        if (ev?.tweeted) {
          await supabase.from("tweet_queue").update({ halt_reason: "REJECT_DUPLICATE_EVENT" }).eq("id", row.id);
          await supabase.from("tweet_decisions").insert({
            article_id: row.article_id, headline: row.headline, canonical_url: row.url,
            event_fingerprint: row.event_fingerprint, tweet_text: row.tweet_text,
            status: "REJECT_DUPLICATE_EVENT", reason: "event already tweeted",
          });
          continue;
        }
      }

      const numbers = extractSubstantiveNumbers(articleText(article as any));
      const check = validateFinalTweet({
        tweet: row.tweet_text,
        article: article as any,
        canonicalUrl: row.url || "",
        articleNumbers: numbers,
      });

      if (!check.valid) {
        await supabase.from("tweet_queue").update({ halt_reason: check.code }).eq("id", row.id);
        await supabase.from("tweet_decisions").insert({
          article_id: row.article_id, headline: row.headline, canonical_url: row.url,
          event_fingerprint: row.event_fingerprint, tweet_text: row.tweet_text,
          status: check.code, reason: `pre-post: ${check.reason}`,
        });
        continue;
      }

      const result = await postTweet(row.tweet_text, creds);

      if (!result.ok) {
        const errMsg = `x_api_${result.status}: ${JSON.stringify(result.raw).slice(0, 400)}`;
        if (result.status === 402 || result.status === 429) {
          await supabase.from("tweet_queue").update({ halt_reason: errMsg.slice(0, 500) }).eq("id", row.id);
        }
        await supabase.from("tweet_decisions").insert({
          article_id: row.article_id, headline: row.headline, canonical_url: row.url,
          event_fingerprint: row.event_fingerprint, tweet_text: row.tweet_text,
          status: "POST_FAILED", reason: errMsg,
        });
        console.error("tweet-hourly-poster X error:", errMsg);
        return new Response(JSON.stringify({ success: false, error: errMsg, articleId: row.article_id }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("tweet_queue")
        .update({ posted: true, posted_at: new Date().toISOString(), twitter_id: result.tweetId || null })
        .eq("id", row.id);

      await supabase.from("tweet_decisions").insert({
        article_id: row.article_id, headline: row.headline, canonical_url: row.url,
        event_fingerprint: row.event_fingerprint, tweet_text: row.tweet_text,
        status: "POSTED", reason: result.tweetId || "posted",
      });

      if (row.event_fingerprint) {
        await supabase.from("news_events")
          .update({ tweeted: true, tweeted_at: new Date().toISOString(), tweet_id: result.tweetId || null })
          .eq("fingerprint", row.event_fingerprint);
      }

      await supabase.from("tweet_schedule_log").insert({
        article_id: row.article_id,
        tweet_text: row.tweet_text,
        tweet_id: result.tweetId || null,
        status: "posted",
      });

      return new Response(
        JSON.stringify({
          success: true,
          articleId: row.article_id,
          tweetId: result.tweetId,
          length: row.tweet_text.length,
          tweetUrl: result.tweetId ? `https://x.com/i/web/status/${result.tweetId}` : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, skipped: true, reason: "nothing valid to post" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tweet-hourly-poster error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
