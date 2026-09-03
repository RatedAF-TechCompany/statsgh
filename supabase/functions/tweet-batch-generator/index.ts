// STATSGH SINGLE TWEET PIPELINE — Stage 1+2 (selection, validation, generation).
// Cron: hourly at :00. Posting is done by tweet-hourly-poster (Stage 3).
//
// Flow: ARTICLE -> GHANA CHECK -> NUMBER EXTRACTION -> STATISTICAL VALIDATION ->
// DUPLICATE CHECK -> RANKING -> AI DRAFT -> NUMBER VERIFICATION -> 200-CHAR CHECK ->
// CANONICAL URL APPENDED -> FINAL VALIDATION -> tweet_queue.
//
// Every decision is written to public.tweet_decisions. If nothing qualifies,
// nothing is queued. A quiet hour is acceptable.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { autoTweetEnabled, autoTweetDisabledResponse } from "../_shared/auto-tweet-flag.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGatewayJson, GatewayHaltError } from "../_shared/ai-gateway.ts";
import {
  MAX_TWEET_LENGTH,
  canonicalUrl,
  eventFingerprint,
  headlineSimilarity,
  validateFinalTweet,
  validateStatisticalArticle,
  type ArticleLike,
  type RejectCode,
  type SubstantiveNumber,
} from "../_shared/statistical-validator.ts";
import {
  finalTweetValidator,
  buildEventDescriptor,
} from "../_shared/editorial-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOOKBACK_HOURS = 6;
const FALLBACK_LOOKBACK_HOURS = 24;
const DUP_LOOKBACK_DAYS = 14; // RULE 7: 14-day event memory
const HEADLINE_SIM_THRESHOLD = 0.55;
const MAX_CANDIDATES_TO_AI = 3;

const SYSTEM_PROMPT = `You are the automated statistical news editor for StatsGH.
Write ONE short factual X post from the supplied StatsGH article.
The tweet must centre on the strongest substantive number in the article.

Rules:
- State the entity clearly.
- Include at least one substantive number.
- Prefer the strongest number early in the sentence.
- Explain what the number measures.
- Use plain English.
- Use GHS rather than GHC.
- Use % rather than spelling out percent.
- Do not use hashtags.
- Do not use emojis.
- Do not use hype.
- Do not add opinion.
- Do not invent any number.
- Do not calculate a new statistic unless that exact calculation appears in the article.
- Do not use dates or years as the main numerical fact.
- Return SKIP if there is no meaningful statistical fact.
- Never write, guess or include any URL. The canonical article URL is appended automatically.
- The tweet will have the canonical article URL appended automatically, so keep the factual text within the character budget supplied.

Respond ONLY as strict JSON:
{"tweet":"...","primary_number":"...","supporting_text":"...","valid":true}
Set "valid": false and "tweet": "SKIP" when no meaningful statistical fact exists.`;

interface Row extends ArticleLike {
  published_at: string | null;
}

async function logDecision(
  supabase: any,
  row: {
    article_id: string | null;
    headline?: string | null;
    canonical_url?: string | null;
    event_fingerprint?: string | null;
    tweet_text?: string | null;
    status: RejectCode;
    reason: string;
    substantive_numbers?: SubstantiveNumber[];
    score?: number;
  },
) {
  await supabase.from("tweet_decisions").insert({
    article_id: row.article_id,
    headline: row.headline ?? null,
    canonical_url: row.canonical_url ?? null,
    event_fingerprint: row.event_fingerprint ?? null,
    tweet_text: row.tweet_text ?? null,
    status: row.status,
    reason: row.reason.slice(0, 500),
    substantive_numbers: (row.substantive_numbers || []).slice(0, 8).map((n) => ({
      raw: n.raw, value: n.value, unit: n.unit, kind: n.kind,
    })),
    score: row.score ?? null,
  });
}

function stripUrls(s: string): string {
  return s.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!(await autoTweetEnabled())) return autoTweetDisabledResponse(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = {
    considered: 0,
    already_seen: 0,
    rejected_not_ghana: 0,
    rejected_no_number: 0,
    rejected_date_only: 0,
    rejected_duplicate: 0,
    sent_to_ai: 0,
    rejected_ai: 0,
    queued: 0,
    halted: false as false | string,
  };

  try {
    /* ---------- 1. Candidate articles ---------- */
    const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();
    let { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, summary, body, slug, category_slug, published_at, event_id, event_fingerprint, editorial_category")
      .eq("is_published", true)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    if (!articles?.length) {
      const wider = new Date(Date.now() - FALLBACK_LOOKBACK_HOURS * 3600_000).toISOString();
      const r = await supabase
        .from("articles")
        .select("id, title, summary, body, slug, category_slug, published_at, event_id, event_fingerprint, editorial_category")
        .eq("is_published", true)
        .gte("published_at", wider)
        .order("published_at", { ascending: false })
        .limit(60);
      articles = r.data || [];
    }

    const list = (articles || []) as Row[];
    stats.considered = list.length;
    if (!list.length) {
      return new Response(JSON.stringify({ success: true, ...stats, note: "no articles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ---------- 2. Duplicate history ---------- */
    const dupSince = new Date(Date.now() - DUP_LOOKBACK_DAYS * 86400_000).toISOString();
    const [{ data: queuedRows }, { data: decidedRows }] = await Promise.all([
      supabase
        .from("tweet_queue")
        .select("article_id, url, headline, event_fingerprint")
        .gte("generated_at", dupSince),
      supabase
        .from("tweet_decisions")
        .select("article_id, canonical_url, headline, event_fingerprint, status")
        .gte("created_at", dupSince)
        .in("status", ["QUEUED", "POSTED"]),
    ]);

    const { data: tweetedEvents } = await supabase
      .from("news_events")
      .select("fingerprint")
      .eq("tweeted", true)
      .gte("first_published_at", dupSince);

    const seenArticleIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenFingerprints = new Set<string>();
    const seenHeadlines: string[] = [];
    for (const r of [...(queuedRows || []), ...(decidedRows || [])] as any[]) {
      if (r.article_id) seenArticleIds.add(r.article_id);
      const u = r.url || r.canonical_url;
      if (u) seenUrls.add(u);
      if (r.event_fingerprint) seenFingerprints.add(r.event_fingerprint);
      if (r.headline) seenHeadlines.push(r.headline);
    }
    for (const e of (tweetedEvents || []) as any[]) {
      if (e.fingerprint) seenFingerprints.add(e.fingerprint);
    }

    /* ---------- 3. Deterministic gates ---------- */
    interface Candidate {
      article: Row;
      url: string;
      numbers: SubstantiveNumber[];
      score: number;
      fingerprint: string;
    }
    const candidates: Candidate[] = [];

    for (const a of list) {
      if (seenArticleIds.has(a.id)) {
        stats.already_seen += 1;
        continue;
      }
      const url = canonicalUrl(a);
      if (!url) {
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, status: "REJECT_URL_MISSING",
          reason: "article has no slug / canonical url",
        });
        continue;
      }
      if (seenUrls.has(url)) {
        stats.rejected_duplicate += 1;
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          status: "REJECT_DUPLICATE_ARTICLE", reason: "canonical url already tweeted",
        });
        continue;
      }

      // RULES 1-4 + 10: the same shared gate the website publication path uses.
      const gate = finalTweetValidator(a as any, { tweetedFingerprints: seenFingerprints,
        fingerprint: (a as any).event_fingerprint || undefined });
      if (!gate.ok) {
        if (gate.code === "REJECT_DUPLICATE_EVENT") stats.rejected_duplicate += 1;
        else if (gate.code === "REJECT_NOT_GHANA") stats.rejected_not_ghana += 1;
        else stats.rejected_no_number += 1;
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          event_fingerprint: gate.fingerprint ?? null,
          status: gate.code as any, reason: gate.reason,
        });
        continue;
      }

      const v = validateStatisticalArticle(a);
      if (!v.qualifies) {
        if (v.code === "REJECT_NOT_GHANA") stats.rejected_not_ghana += 1;
        else if (v.code === "REJECT_DATE_ONLY") stats.rejected_date_only += 1;
        else stats.rejected_no_number += 1;
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          status: v.code || "REJECT_NO_SUBSTANTIVE_NUMBER", reason: v.reason,
          substantive_numbers: v.substantiveNumbers,
        });
        continue;
      }

      const fingerprint = (a as any).event_fingerprint
        || gate.fingerprint
        || buildEventDescriptor(a as any).fingerprint
        || eventFingerprint(a.title, v.substantiveNumbers[0]?.raw);
      const dupEvent =
        seenFingerprints.has(fingerprint) ||
        seenHeadlines.some((h) => headlineSimilarity(h, a.title) >= HEADLINE_SIM_THRESHOLD);
      if (dupEvent) {
        stats.rejected_duplicate += 1;
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          event_fingerprint: fingerprint, status: "REJECT_DUPLICATE_EVENT",
          reason: "same underlying event already tweeted within 14 days",
          substantive_numbers: v.substantiveNumbers, score: v.score,
        });
        continue;
      }

      candidates.push({ article: a, url, numbers: v.substantiveNumbers, score: v.score, fingerprint });
    }

    if (!candidates.length) {
      return new Response(JSON.stringify({ success: true, ...stats, note: "nothing qualified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ---------- 4. Rank, then AI draft strongest first ---------- */
    candidates.sort((a, b) => b.score - a.score);

    for (const c of candidates.slice(0, MAX_CANDIDATES_TO_AI)) {
      const { article: a, url, numbers } = c;
      const budget = MAX_TWEET_LENGTH - url.length - 1;
      if (budget < 60) {
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          status: "REJECT_OVER_200_CHARS", reason: `url too long, only ${budget} chars available`,
        });
        continue;
      }

      const factList = numbers.slice(0, 8).map((n) => `- ${n.raw} (${n.context.slice(0, 120)})`).join("\n");
      const userPrompt = `Character budget for the factual sentence: ${budget} characters (hard maximum, the URL is appended separately).

Headline: ${a.title}

Extracted numerical facts from the article:
${factList}

Article text:
${(a.summary || "")}\n${(a.body || "").slice(0, 3000)}`;

      let draft: { tweet?: string; primary_number?: string; valid?: boolean } = {};
      stats.sent_to_ai += 1;
      try {
        draft = await callGatewayJson({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.2,
        });
      } catch (err) {
        if (err instanceof GatewayHaltError) {
          stats.halted = err.reason;
          break;
        }
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          status: "REJECT_VALIDATION_FAILED", reason: `ai_error: ${(err as Error).message}`,
        });
        continue;
      }

      let text = stripUrls(String(draft.tweet ?? "")).replace(/^["']|["']$/g, "").trim();
      if (!text || /^skip$/i.test(text) || draft.valid === false) {
        stats.rejected_ai += 1;
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          status: "REJECT_AI_SKIP", reason: "model found no meaningful statistical fact",
          substantive_numbers: numbers, score: c.score,
        });
        continue;
      }

      // Compose, then validate. One shortening retry if over budget.
      let finalTweet = `${text} ${url}`;
      if (finalTweet.length > MAX_TWEET_LENGTH) {
        try {
          const retry = await callGatewayJson<{ tweet?: string }>({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
              { role: "assistant", content: JSON.stringify({ tweet: text }) },
              {
                role: "user",
                content: `Too long. Rewrite the same factual sentence in at most ${budget} characters. Keep the number exactly as stated. Same JSON shape.`,
              },
            ],
            max_tokens: 300,
            temperature: 0.1,
          });
          text = stripUrls(String(retry.tweet ?? "")).replace(/^["']|["']$/g, "").trim();
          finalTweet = `${text} ${url}`;
        } catch (err) {
          if (err instanceof GatewayHaltError) {
            stats.halted = err.reason;
            break;
          }
        }
      }

      const check = validateFinalTweet({
        tweet: finalTweet,
        article: a,
        canonicalUrl: url,
        articleNumbers: numbers,
      });
      if (!check.valid) {
        stats.rejected_ai += 1;
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          event_fingerprint: c.fingerprint, tweet_text: finalTweet,
          status: check.code, reason: check.reason,
          substantive_numbers: numbers, score: c.score,
        });
        continue;
      }

      const fingerprint = c.fingerprint;
      const { error: insErr } = await supabase.from("tweet_queue").insert({
        article_id: a.id,
        event_id: (a as any).event_id ?? null,
        tweet_text: finalTweet,
        url,
        headline: a.title,
        event_fingerprint: fingerprint,
        primary_number: check.primaryNumber ?? null,
      });
      if (insErr) {
        await logDecision(supabase, {
          article_id: a.id, headline: a.title, canonical_url: url,
          status: "REJECT_VALIDATION_FAILED", reason: `queue_insert: ${insErr.message}`,
        });
        continue;
      }

      stats.queued += 1;
      await logDecision(supabase, {
        article_id: a.id, headline: a.title, canonical_url: url,
        event_fingerprint: fingerprint, tweet_text: finalTweet,
        status: "QUEUED", reason: `len=${finalTweet.length}`,
        substantive_numbers: numbers, score: c.score,
      });
      break; // one qualifying tweet per run
    }

    return new Response(JSON.stringify({ success: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("statsgh-tweet-pipeline error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg, ...stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
