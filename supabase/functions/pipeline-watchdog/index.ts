// Pipeline watchdog: records publishing freshness and newsroom run health in
// pipeline_health, and (a) when nothing has been published for CATCHUP_HOURS
// inside 07:00-22:00 Europe/London, fires one catch-up newsroom-scan with
// triggerType "watchdog" (12h freshness window). No emails or tweets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";

const STALE_HOURS = 6;      // reporting threshold (unchanged)
const CATCHUP_HOURS = 2.5;  // act well before the 6h hard limit
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const auth = await authorizeCaller(req, supabase);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401);
  const now = new Date();

  const { data: last } = await supabase.from("articles").select("published_at")
    .eq("is_published", true).not("published_at", "is", null).lte("published_at", now.toISOString())
    .order("published_at", { ascending: false }).limit(1).maybeSingle();
  const lastPub = last?.published_at ? new Date(last.published_at) : null;
  const hours = lastPub ? (now.getTime() - lastPub.getTime()) / 36e5 : null;

  // Zeb's window is UK time (handles GMT/BST automatically).
  const ukHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now));
  const inWindow = ukHour >= 7 && ukHour < 22;
  const stale = inWindow && (hours === null || hours > STALE_HOURS);
  const needsCatchup = inWindow && (hours === null || hours > CATCHUP_HOURS);

  const { data: runs } = await supabase.from("newsroom_runs").select("status, started_at, error_message, trigger_type")
    .order("started_at", { ascending: false }).limit(3);
  const isFailed = (r: { status: string | null; started_at: string | null }) =>
    ["failed", "error", "timeout"].includes(String(r.status).toLowerCase()) ||
    (String(r.status).toLowerCase() === "running" && !!r.started_at && now.getTime() - new Date(r.started_at).getTime() > 36e5);
  let consecutive = 0;
  for (const r of runs ?? []) { if (isFailed(r)) consecutive++; else break; }
  const failing = (runs?.length ?? 0) >= 3 && consecutive >= 3;

  // Catch-up only when the newsroom itself has not run recently. newsroom_runs
  // never stores trigger_type "watchdog" (CHECK constraint allows only
  // manual/scheduled), so the old per-type check never matched; with job 20 on
  // */30 a catch-up would just race it. This is now a safety net for a stopped job.
  let catchupFired = false;
  let catchupSkipped = false;
  if (needsCatchup) {
    const since = new Date(now.getTime() - 35 * 60e3).toISOString();
    const { count } = await supabase.from("newsroom_runs").select("id", { count: "exact", head: true })
      .gte("started_at", since);
    catchupSkipped = !!count;
    if (!count) {
      const res = await fetch(`${supabaseUrl}/functions/v1/newsroom-scheduled`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "watchdog" }),
      }).catch(() => null);
      catchupFired = !!res && res.status < 300;
    }
  }

  const status = stale && failing ? "stale_and_failing" : stale ? "stale" : failing ? "runs_failing" : "ok";
  const row = {
    status,
    last_published_at: lastPub?.toISOString() ?? null,
    hours_since_publish: hours === null ? null : Math.round(hours * 100) / 100,
    in_active_window: inWindow,
    last_run_status: runs?.[0]?.status ?? null,
    last_run_at: runs?.[0]?.started_at ?? null,
    consecutive_failed_runs: consecutive,
    notes: [failing ? `Last 3 runs failed: ${runs?.[0]?.error_message ?? "no error message"}` : null,
            catchupFired ? "watchdog catch-up scan fired" : null,
            catchupSkipped ? "catch-up skipped: newsroom ran in last 35 min" : null].filter(Boolean).join(" | ").slice(0, 500) || null,
  };
  const { error } = await supabase.from("pipeline_health").insert(row);
  if (error) return json({ error: error.message }, 500);
  return json({ ...row, catchup_fired: catchupFired });
});
