// Daily rollup for the unified StatsGH Twitter pipeline.
// Cron: 00:10 UTC. Computes counters for the previous UTC day and upserts
// them into public.daily_twitter_metrics.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function countInWindow(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
  start: string,
  end: string,
  filter?: (q: any) => any,
): Promise<number> {
  let q = supabase.from(table).select("*", { count: "exact", head: true })
    .gte(column, start).lt(column, end);
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) {
    console.error(`count ${table} error:`, error.message);
    return 0;
  }
  return count || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();
    const dayStr = startIso.slice(0, 10);

    const [
      articlesPublished,
      keywordRejected,
      aiRejected,
      generated,
      posted,
    ] = await Promise.all([
      countInWindow(supabase, "articles", "published_at", startIso, endIso,
        (q) => q.eq("is_published", true)),
      countInWindow(supabase, "articles_rejected_scoring", "rejected_at", startIso, endIso),
      countInWindow(supabase, "articles_rejected_ai", "rejected_at", startIso, endIso),
      countInWindow(supabase, "tweet_queue", "generated_at", startIso, endIso),
      countInWindow(supabase, "tweet_queue", "posted_at", startIso, endIso,
        (q) => q.eq("posted", true)),
    ]);

    const passedKeyword = Math.max(articlesPublished - keywordRejected, 0);

    const row = {
      day: dayStr,
      articles_published: articlesPublished,
      articles_passed_keyword_gate: passedKeyword,
      articles_rejected_at_keyword: keywordRejected,
      articles_rejected_at_ai: aiRejected,
      tweets_generated: generated,
      tweets_posted: posted,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from("daily_twitter_metrics")
      .upsert(row, { onConflict: "day" });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true, ...row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tweet-metrics-rollup error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
