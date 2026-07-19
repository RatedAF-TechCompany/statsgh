// Daily batch tweet filter.
// Cron: every day at 00:01 UTC.
// Collection window: 06:00–23:59 UTC of the PREVIOUS day.
//
// Flow:
//  1. Query articles published in the window.
//  2. Strict StatsGH quality gate via callGateway (gemini-2.5-flash-lite, JSON).
//  3. For passing articles, generate a tweet (≤240 chars, present perfect,
//     one specific number, Ghana angle, URL appended as [Read: {url}]).
//  4. Insert generated tweets into public.daily_tweet_queue.
//  5. Log every fail into public.tweet_rejections.
//
// The hourly-tweet-poster function drains the queue.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGateway, callGatewayJson, GatewayHaltError } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_ORIGIN = "https://statsgh.com";

const FILTER_SYSTEM = `You are StatsGH's tweet quality gate. Article MUST meet ALL criteria to PASS:
1. Ghana-focused (not international, not other African countries)
2. Contains concrete economic/financial/political-economic data (specific numbers, rates, budgets, policies affecting markets/jobs/public finance)
3. Does NOT include: sports/entertainment, international crime, pure disaster/flooding (unless it has economic impact quantified), lifestyle/opinion without numbers, speculative trend pieces
Respond ONLY with {"pass": true} or {"pass": false, "reason": "..."}`;

const TWEET_SYSTEM = `Write a single tweet <=240 chars for StatsGH. Must include: (1) one specific number/currency/percentage, (2) Ghana angle, (3) article URL at end as [Read: {url}]. Tense: present perfect only. No hashtags/emojis/dashes. Output ONLY the tweet text.`;

function buildArticleUrl(a: { slug: string | null; category_slug: string | null }): string {
  const cat = (a.category_slug || "news").trim().replace(/^\/+|\/+$/g, "");
  const slug = (a.slug || "").trim().replace(/^\/+|\/+$/g, "");
  return `${SITE_ORIGIN}/${cat}/${slug}/`;
}

interface DayArticle {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  slug: string | null;
  category_slug: string | null;
  published_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Compute previous-day window in UTC: 06:00 -> 23:59:59.
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d - 1, 6, 0, 0)).toISOString();
  const end = new Date(Date.UTC(y, m, d - 1, 23, 59, 59)).toISOString();

  try {
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, summary, body, slug, category_slug, published_at")
      .eq("is_published", true)
      .gte("published_at", start)
      .lte("published_at", end)
      .order("published_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const list: DayArticle[] = (articles || []) as DayArticle[];

    // Skip articles already queued today (idempotency).
    const ids = list.map((a) => a.id);
    const { data: existing } = ids.length
      ? await supabase.from("daily_tweet_queue").select("article_id").in("article_id", ids)
      : { data: [] as { article_id: string }[] };
    const alreadyQueued = new Set((existing || []).map((r: any) => r.article_id));

    const results = {
      window_start: start,
      window_end: end,
      total: list.length,
      already_queued: alreadyQueued.size,
      passed: 0,
      rejected: 0,
      generated: 0,
      halted: false as false | string,
    };

    for (const a of list) {
      if (alreadyQueued.has(a.id)) continue;

      const source = (a.summary && a.summary.length > 40 ? a.summary : (a.body || "").slice(0, 1500)) || a.title;
      const userPayload = `Title: ${a.title}\n\nArticle: ${source}`;

      // Strict filter.
      let verdict: { pass?: boolean; reason?: string } = {};
      try {
        verdict = await callGatewayJson<{ pass?: boolean; reason?: string }>({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: FILTER_SYSTEM },
            { role: "user", content: userPayload },
          ],
          max_tokens: 100,
          temperature: 0.1,
        });
      } catch (err) {
        if (err instanceof GatewayHaltError) {
          results.halted = err.reason;
          break;
        }
        // Treat unparseable output as a soft reject.
        verdict = { pass: false, reason: `filter_error: ${(err as Error).message.slice(0, 120)}` };
      }

      if (!verdict.pass) {
        results.rejected += 1;
        await supabase.from("tweet_rejections").insert({
          article_id: a.id,
          reject_reason: verdict.reason?.slice(0, 500) || "no_reason",
        });
        continue;
      }

      results.passed += 1;

      // Generate tweet.
      const url = buildArticleUrl(a);
      let tweetText: string | null = null;
      try {
        const { content } = await callGateway({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: TWEET_SYSTEM },
            { role: "user", content: `URL: ${url}\nTitle: ${a.title}\n\nArticle: ${source}` },
          ],
          max_tokens: 200,
          temperature: 0.2,
        });
        tweetText = (content || "")
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/\s+/g, " ")
          .trim();
      } catch (err) {
        if (err instanceof GatewayHaltError) {
          results.halted = err.reason;
          break;
        }
        await supabase.from("tweet_rejections").insert({
          article_id: a.id,
          reject_reason: `tweet_gen_error: ${(err as Error).message.slice(0, 200)}`,
        });
        continue;
      }

      if (!tweetText) {
        await supabase.from("tweet_rejections").insert({
          article_id: a.id,
          reject_reason: "empty_tweet_output",
        });
        continue;
      }

      // Ensure the URL marker is present.
      if (!tweetText.includes(url)) {
        const marker = ` [Read: ${url}]`;
        const budget = 280 - marker.length;
        const head = tweetText.length > budget ? tweetText.slice(0, budget - 1).trimEnd() : tweetText;
        tweetText = head + marker;
      }
      if (tweetText.length > 280) tweetText = tweetText.slice(0, 277) + "...";

      await supabase.from("daily_tweet_queue").insert({
        article_id: a.id,
        tweet_text: tweetText,
        url,
      });
      results.generated += 1;
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("daily-batch-tweet-filter error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
