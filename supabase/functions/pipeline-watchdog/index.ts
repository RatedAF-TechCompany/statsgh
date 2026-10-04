// Pipeline watchdog: records publishing freshness and newsroom run health in
// pipeline_health. Read-only on articles/newsroom_runs; no emails or tweets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const STALE_HOURS = 6;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();

  const { data: last } = await supabase.from("articles").select("published_at")
    .eq("is_published", true).not("published_at", "is", null).lte("published_at", now.toISOString())
    .order("published_at", { ascending: false }).limit(1).maybeSingle();
  const lastPub = last?.published_at ? new Date(last.published_at) : null;
  const hours = lastPub ? (now.getTime() - lastPub.getTime()) / 36e5 : null;

  // Africa/Accra is UTC+0 year-round.
  const accraHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Accra" }).format(now));
  const inWindow = accraHour >= 6 && accraHour < 23;
  const stale = inWindow && (hours === null || hours > STALE_HOURS);

  const { data: runs } = await supabase.from("newsroom_runs").select("status, started_at, error_message")
    .order("started_at", { ascending: false }).limit(3);
  const isFailed = (r: { status: string | null; started_at: string | null }) =>
    ["failed", "error", "timeout"].includes(String(r.status).toLowerCase()) ||
    (String(r.status).toLowerCase() === "running" && !!r.started_at && now.getTime() - new Date(r.started_at).getTime() > 36e5);
  let consecutive = 0;
  for (const r of runs ?? []) { if (isFailed(r)) consecutive++; else break; }
  const failing = (runs?.length ?? 0) >= 3 && consecutive >= 3;

  const status = stale && failing ? "stale_and_failing" : stale ? "stale" : failing ? "runs_failing" : "ok";
  const row = {
    status,
    last_published_at: lastPub?.toISOString() ?? null,
    hours_since_publish: hours === null ? null : Math.round(hours * 100) / 100,
    in_active_window: inWindow,
    last_run_status: runs?.[0]?.status ?? null,
    last_run_at: runs?.[0]?.started_at ?? null,
    consecutive_failed_runs: consecutive,
    notes: failing ? `Last 3 runs failed: ${runs?.[0]?.error_message ?? "no error message"}`.slice(0, 500) : null,
  };
  const { error } = await supabase.from("pipeline_health").insert(row);
  if (error) return json({ error: error.message }, 500);
  return json(row);
});
