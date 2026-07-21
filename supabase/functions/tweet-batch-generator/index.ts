// Stage 2 of the unified StatsGH Twitter pipeline.
// Cron: every 6 hours (0 0,6,12,18 * * *).
//
// - Collects published articles from the last 6h.
// - Filters via free keyword gate (_shared/tweet-scoring).
//   Failures logged to articles_rejected_scoring; no AI cost.
// - Sends ONE bulk call to gemini-2.5-flash-lite for up to 10 articles.
// - Parses per-article {tweet, reject_reason}; inserts winners into tweet_queue,
//   losers into articles_rejected_ai.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGatewayJson, GatewayHaltError } from "../_shared/ai-gateway.ts";
import { passesKeywordGate } from "../_shared/tweet-scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_ORIGIN = "https://statsgh.com";
const BATCH_MAX = 10;

const BATCH_SYSTEM = `You are StatsGH's tweet generator. Generate ONE tweet per article. CRITICAL: every tweet MUST end with the article URL.

FORMULA (non-negotiable):
- <=160 characters INCLUDING the URL (URL is ~40-50 chars)
- [Entity/Action] + [SPECIFIC AMOUNT/NUMBER] + [Ghana economic impact]
- Present tense or present perfect only ("has", "recorded", "approved", "increased")
- Number lands in first 40 characters
- MUST end with: [Read: {url}] using the exact url provided for that article
- If article url is null/missing, set tweet=null and reject_reason="no_url"
- NO opinion, speculation, hashtags, emojis, em-dashes
- Example: "BoG increased gold holdings to 40 tonnes, 42% of reserves. [Read: https://statsgh.com/economy/bog-gold/]"

If article has no quantifiable number, no Ghana economic angle, or is pure opinion, set tweet=null with a short reject_reason.

Respond ONLY as strict JSON: { "results": [ { "article_id": "...", "tweet": "..." | null, "url_included": true | false, "reject_reason": "..." | null } ] }`;

interface Candidate {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  slug: string | null;
  category_slug: string | null;
  published_at: string | null;
  score: number;
}

interface BatchResult {
  article_id: string;
  tweet: string | null;
  url_included?: boolean;
  reject_reason?: string | null;
}

function buildUrl(a: { slug: string | null; category_slug: string | null }): string {
  const cat = (a.category_slug || "news").trim().replace(/^\/+|\/+$/g, "");
  const slug = (a.slug || "").trim().replace(/^\/+|\/+$/g, "");
  return `${SITE_ORIGIN}/${cat}/${slug}/`;
}

function enforceLength(tweet: string, url: string | null): string {
  let t = tweet.trim().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");
  // Replace literal {url} placeholder or [Read: {url}] with real URL if present.
  if (url) {
    t = t.replace(/\{url\}/g, url);
    if (!t.includes(url)) {
      const marker = ` [Read: ${url}]`;
      const budget = 280 - marker.length;
      const head = t.length > budget ? t.slice(0, budget - 1).trimEnd() : t;
      t = head + marker;
    }
  }
  if (t.length > 280) t = t.slice(0, 277) + "...";
  return t;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const sinceIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, summary, body, slug, category_slug, published_at")
      .eq("is_published", true)
      .gte("published_at", sinceIso)
      .order("published_at", { ascending: false })
      .limit(80);
    if (error) throw error;

    const list = (articles || []) as Array<Omit<Candidate, "score">>;
    if (!list.length) {
      return new Response(
        JSON.stringify({ success: true, window_start: sinceIso, considered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter out already-processed articles.
    const ids = list.map((a) => a.id);
    const [{ data: queued }, { data: scoreRej }, { data: aiRej }] = await Promise.all([
      supabase.from("tweet_queue").select("article_id").in("article_id", ids),
      supabase.from("articles_rejected_scoring").select("article_id").in("article_id", ids),
      supabase.from("articles_rejected_ai").select("article_id").in("article_id", ids),
    ]);
    const seen = new Set<string>([
      ...((queued || []) as any[]).map((r) => r.article_id),
      ...((scoreRej || []) as any[]).map((r) => r.article_id),
      ...((aiRej || []) as any[]).map((r) => r.article_id),
    ]);

    const stats = {
      considered: list.length,
      already_processed: 0,
      keyword_rejected: 0,
      passed_keyword: 0,
      sent_to_ai: 0,
      generated: 0,
      ai_rejected: 0,
      halted: false as false | string,
    };

    const passed: Candidate[] = [];
    for (const a of list) {
      if (seen.has(a.id)) {
        stats.already_processed += 1;
        continue;
      }
      const summary = a.summary || (a.body || "").slice(0, 400);
      const gate = passesKeywordGate(a.title, summary);
      if (!gate.pass) {
        stats.keyword_rejected += 1;
        await supabase.from("articles_rejected_scoring").insert({
          article_id: a.id,
          headline: a.title,
          score: gate.score,
          reason: `keyword_gate<${3}> hits=${gate.hits.slice(0, 5).join(",")}`,
        });
        continue;
      }
      stats.passed_keyword += 1;
      passed.push({ ...a, score: gate.score });
    }

    // Take top-N by score for the AI batch.
    passed.sort((a, b) => b.score - a.score);
    const batch = passed.slice(0, BATCH_MAX);
    stats.sent_to_ai = batch.length;

    if (batch.length) {
      const userPayload = batch
        .map((a, i) => {
          const summary = (a.summary || (a.body || "").slice(0, 600)).replace(/\s+/g, " ").trim();
          const url = buildUrl(a);
          return `[${i + 1}] article_id: ${a.id}\nURL: ${url}\nHeadline: ${a.title}\nSummary: ${summary.slice(0, 700)}`;
        })
        .join("\n\n");

      let parsed: { results?: BatchResult[] } = {};
      try {
        parsed = await callGatewayJson<{ results?: BatchResult[] }>({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: BATCH_SYSTEM },
            { role: "user", content: userPayload },
          ],
          max_tokens: 800,
          temperature: 0.2,
        });
      } catch (err) {
        if (err instanceof GatewayHaltError) {
          stats.halted = err.reason;
        } else {
          console.error("tweet-batch-generator AI error:", (err as Error).message);
          return new Response(
            JSON.stringify({ success: false, error: (err as Error).message, stats }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const results: BatchResult[] = Array.isArray(parsed?.results) ? parsed.results! : [];
      const byId = new Map(batch.map((a) => [a.id, a]));

      for (const r of results) {
        const src = byId.get(r.article_id);
        if (!src) continue; // hallucinated id
        if (!r.tweet) {
          stats.ai_rejected += 1;
          await supabase.from("articles_rejected_ai").insert({
            article_id: r.article_id,
            reason: (r.reject_reason || "ai_returned_null").slice(0, 500),
          });
          continue;
        }
        const url = buildUrl(src);
        const hasUrl = r.tweet.includes(url) || r.url_included === true;
        if (!hasUrl) {
          await supabase.from("tweets_missing_urls").insert({
            article_id: r.article_id,
            tweet_text: r.tweet,
            url_provided: url,
            reason: "model_omitted_url",
          });
        }
        const finalTweet = enforceLength(r.tweet, url);
        // Final guard: enforceLength always appends url if missing.
        if (!finalTweet.includes(url)) {
          await supabase.from("tweets_missing_urls").insert({
            article_id: r.article_id,
            tweet_text: finalTweet,
            url_provided: url,
            reason: "url_still_missing_after_enforce",
          });
          continue;
        }
        const { error: insErr } = await supabase.from("tweet_queue").insert({
          article_id: r.article_id,
          tweet_text: finalTweet,
          url,
        });
        if (insErr && !/duplicate/i.test(insErr.message)) {
          console.error("tweet_queue insert error:", insErr.message);
          continue;
        }
        stats.generated += 1;
      }

      // Any batch article the model omitted entirely -> mark as ai_rejected.
      const returnedIds = new Set(results.map((r) => r.article_id));
      for (const a of batch) {
        if (!returnedIds.has(a.id)) {
          await supabase.from("articles_rejected_ai").insert({
            article_id: a.id,
            reason: "ai_omitted_from_batch",
          });
          stats.ai_rejected += 1;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, window_start: sinceIso, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tweet-batch-generator error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
