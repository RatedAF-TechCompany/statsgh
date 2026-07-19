// statsgh-tweet-validator-v2
//
// Enforces the StatsGH winning formula derived from the 5-year top-10 tweet
// analysis. Two-stage AI pipeline:
//   1. VALIDATOR (gemini-2.5-flash-lite, JSON, max_tokens 60) — pass/fail gate.
//   2. REWRITER (gemini-2.5-flash-lite, max_tokens 100) — attempts rescue.
//      Returns literal "REJECTED" when no quantifiable data exists.
//
// Callable two ways:
//   A. POST { tweet_draft, article: { headline, summary, url? } }
//      -> { status: "pass"|"rewritten"|"rejected", tweet?, reason? }
//   B. POST { article_id }
//      -> Loads the article, drafts an initial tweet, runs pipeline,
//         and on pass/rewrite inserts into daily_tweet_queue.
//
// Rejections are logged to public.tweet_rejections.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGateway, callGatewayJson, GatewayHaltError } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_ORIGIN = "https://statsgh.com";
const MAX_LEN = 160;

const WINNING_FORMULA = `STATSGH WINNING FORMULA (5-year top-10 analysis):
Every tweet that hit 300+ engagement includes:
1. SPECIFIC CURRENCY AMOUNT (GHS, USD, AUD, tonnes, percentage, count). No vague "significant" or "increased" without a number.
2. AGENCY + ACTION: [Institution/Company] + [did X] + [resulting in Y].
3. GHANA-FIRST ECONOMIC IMPACT: quantified cost, job impact, trade consequence, policy effect.
4. PRESENT TENSE or PRESENT PERFECT only ("has increased", "recorded", "banned").
5. <=160 CHARS for maximum reach. Number lands in first 40 chars.

TOP PERFORMERS:
- "Parliament has requested Interior Ministry refund GHS113m to 500,000 applicants" (3,755 eng)
- "MobileMoney recorded GHS4.1 trillion in transactions in 2025" (694 eng)
- "BoG increased gold holdings to 40 tonnes, 42% of reserves" (526 eng)
- "87,000 palm wine tappers in Ghana. More than teachers and doctors put together" (396 eng)
- "Ghana increased tomato farming after Burkina Faso banned exports" (357 eng)
- "PAC Chair Abena will recuse from GHS68.7b audit probe" (332 eng)

REJECT IF:
- No quantifiable number (amount, %, count, rate, tonnes)
- International news without Ghana economic nexus
- Political seat counts, election commentary, personality gossip
- Opinion/speculation ("will wipeout", "could become") even if engaging
- No agency (passive voice, "it was reported that...")`;

const VALIDATOR_SYSTEM = `${WINNING_FORMULA}

Task: validate a proposed StatsGH tweet against the formula.
Respond ONLY with strict JSON: {"pass": true} or {"pass": false, "reason": "which gate fails"}.`;

const REWRITER_SYSTEM = `${WINNING_FORMULA}

Task: rewrite a failed tweet so it matches the formula, using ONLY facts present in the article headline/summary.
Rules:
- <=160 chars. Number in first 40 chars. Named agency. Ghana economic angle.
- Present tense or present perfect only. No hashtags, emojis, em-dashes.
- If the article contains NO quantifiable number/data, output literally: REJECTED
- Otherwise output ONLY the rewritten tweet text, nothing else.`;

const DRAFTER_SYSTEM = `${WINNING_FORMULA}

Task: draft a first-pass StatsGH tweet from an article. <=160 chars, number in first 40 chars, named agency, Ghana angle, present tense/perfect. No hashtags/emojis/em-dashes. If no quantifiable data exists in the article, output literally: REJECTED. Otherwise output ONLY the tweet text.`;

interface ValidatorInput {
  tweet_draft?: string;
  article?: { headline?: string; summary?: string; url?: string };
  article_id?: string;
}

function buildArticleUrl(a: { slug: string | null; category_slug: string | null }): string {
  const cat = (a.category_slug || "news").trim().replace(/^\/+|\/+$/g, "");
  const slug = (a.slug || "").trim().replace(/^\/+|\/+$/g, "");
  return `${SITE_ORIGIN}/${cat}/${slug}/`;
}

function appendUrl(tweet: string, url: string | undefined): string {
  if (!url) return tweet.slice(0, 280);
  if (tweet.includes(url)) return tweet.slice(0, 280);
  const marker = ` [Read: ${url}]`;
  const budget = 280 - marker.length;
  const head = tweet.length > budget ? tweet.slice(0, budget - 1).trimEnd() : tweet;
  return head + marker;
}

async function runValidator(tweet: string): Promise<{ pass: boolean; reason?: string }> {
  return await callGatewayJson<{ pass: boolean; reason?: string }>({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: VALIDATOR_SYSTEM },
      { role: "user", content: tweet },
    ],
    max_tokens: 60,
    temperature: 0.1,
  });
}

async function runRewriter(failed: string, headline: string, summary: string): Promise<string> {
  const { content } = await callGateway({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: REWRITER_SYSTEM },
      { role: "user", content: `Failed tweet: ${failed}\n\nHeadline: ${headline}\n\nSummary: ${summary}` },
    ],
    max_tokens: 100,
    temperature: 0.2,
  });
  return (content || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ").trim();
}

async function runDrafter(headline: string, summary: string): Promise<string> {
  const { content } = await callGateway({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      { role: "system", content: DRAFTER_SYSTEM },
      { role: "user", content: `Headline: ${headline}\n\nSummary: ${summary}` },
    ],
    max_tokens: 100,
    temperature: 0.2,
  });
  return (content || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const input: ValidatorInput = await req.json().catch(() => ({}));

    let tweetDraft = (input.tweet_draft || "").trim();
    let headline = input.article?.headline || "";
    let summary = input.article?.summary || "";
    let url = input.article?.url;
    let articleId: string | null = input.article_id || null;

    // Mode B: hydrate from article_id and draft an initial tweet.
    if (articleId) {
      const { data: a, error } = await supabase
        .from("articles")
        .select("id, title, summary, body, slug, category_slug")
        .eq("id", articleId)
        .maybeSingle();
      if (error || !a) {
        return new Response(JSON.stringify({ error: "article not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      headline = a.title;
      summary = a.summary || (a.body || "").slice(0, 1200);
      url = buildArticleUrl(a as any);
      if (!tweetDraft) tweetDraft = await runDrafter(headline, summary);
    }

    if (!tweetDraft) {
      return new Response(JSON.stringify({ error: "tweet_draft or article_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Drafter may itself have refused.
    if (tweetDraft.toUpperCase() === "REJECTED") {
      if (articleId) {
        await supabase.from("tweet_rejections").insert({
          article_id: articleId,
          reject_reason: "drafter_rejected_no_data",
        });
      }
      return new Response(JSON.stringify({ status: "rejected", reason: "no quantifiable data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stage 1: validate.
    const verdict = await runValidator(tweetDraft);
    let finalTweet: string | null = null;
    let status: "pass" | "rewritten" | "rejected" = "rejected";
    let reason: string | undefined;

    if (verdict.pass) {
      finalTweet = tweetDraft;
      status = "pass";
    } else {
      reason = verdict.reason;
      // Stage 2: rewrite.
      if (headline) {
        const rewritten = await runRewriter(tweetDraft, headline, summary);
        if (rewritten && rewritten.toUpperCase() !== "REJECTED") {
          const secondVerdict = await runValidator(rewritten);
          if (secondVerdict.pass) {
            finalTweet = rewritten;
            status = "rewritten";
          } else {
            reason = `rewrite_failed_validator: ${secondVerdict.reason || ""}`;
          }
        } else {
          reason = "rewriter_rejected_no_data";
        }
      }
    }

    if (!finalTweet) {
      if (articleId) {
        await supabase.from("tweet_rejections").insert({
          article_id: articleId,
          reject_reason: (reason || "validator_failed").slice(0, 500),
        });
      }
      return new Response(JSON.stringify({ status: "rejected", reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Length enforcement: <=160 for the message body; URL is appended after.
    if (finalTweet.length > MAX_LEN) finalTweet = finalTweet.slice(0, MAX_LEN - 1).trimEnd();
    const withUrl = appendUrl(finalTweet, url);

    // If invoked with article_id, enqueue.
    if (articleId) {
      await supabase.from("daily_tweet_queue").insert({
        article_id: articleId,
        tweet_text: withUrl,
        url: url || null,
      });
    }

    return new Response(JSON.stringify({ status, tweet: withUrl, reason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof GatewayHaltError) {
      return new Response(JSON.stringify({ error: "ai_halted", reason: err.reason }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("statsgh-tweet-validator-v2 error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
