// Daily editorial metrics rollup. Aggregates activity for the previous UTC day.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const dateKey = start.toISOString().slice(0, 10);

  const { data: rej } = await sb.from("editorial_rejections")
    .select("tier").gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  const { data: appr } = await sb.from("editorial_approvals")
    .select("approval_path").gte("approved_at", start.toISOString()).lt("approved_at", end.toISOString());
  const { data: articles } = await sb.from("articles")
    .select("editorial_status, formula_score, published, published_at")
    .gte("created_at", start.toISOString()).lt("created_at", end.toISOString());

  const tier1 = (rej ?? []).filter(r => r.tier === "tier_1_instant").length;
  const tier2 = (rej ?? []).filter(r => r.tier === "tier_2_formula").length;
  const tier3 = (rej ?? []).filter(r => r.tier === "tier_3_editor").length;
  const auto = (appr ?? []).filter(a => a.approval_path === "auto").length;
  const editorApproved = (appr ?? []).filter(a => a.approval_path === "editor").length;
  const awaiting = (articles ?? []).filter(a => a.editorial_status === "awaiting_editor").length;
  const publishedCount = (articles ?? []).filter(a => a.published).length;
  const scores = (articles ?? []).map(a => Number(a.formula_score)).filter(n => !Number.isNaN(n));
  const avg = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null;

  const metrics = {
    articles_submitted: articles?.length ?? 0,
    articles_rejected_tier1: tier1,
    articles_rejected_tier2: tier2,
    articles_rejected_tier3: tier3,
    articles_approved_auto: auto,
    articles_approved_editor: editorApproved,
    articles_awaiting_editor: awaiting,
    articles_published: publishedCount,
    avg_formula_score: avg,
  };

  await sb.from("editorial_daily_metrics").upsert({
    date: dateKey, metrics_json: metrics, updated_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ date: dateKey, metrics }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
