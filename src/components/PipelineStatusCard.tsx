import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }) + " GMT" : "—";

const LABEL: Record<string, string> = {
  ok: "Pipeline healthy",
  stale: "No article published for over 6 hours",
  runs_failing: "Last 3 newsroom runs failed",
  stale_and_failing: "Stale: nothing published and last 3 runs failed",
};

/** Red/green newsroom pipeline status from the latest pipeline_health row (admins only). */
export const PipelineStatusCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_health").select("*").order("checked_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    refetchInterval: 60000,
  });
  if (isLoading) return null;
  if (!data) {
    return <div className="mb-8 border border-border p-4 text-sm text-muted-foreground">Pipeline status: no health check recorded yet.</div>;
  }
  const ok = data.status === "ok";
  return (
    <div role="status" className={`mb-8 border-l-4 p-4 ${ok ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${ok ? "bg-green-600" : "bg-red-600"}`} aria-hidden />
        <h2 className={`font-semibold ${ok ? "text-green-800" : "text-red-800"}`}>{LABEL[data.status] ?? data.status}</h2>
      </div>
      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Last published</dt><dd>{fmt(data.last_published_at)}{data.hours_since_publish != null ? ` (${Number(data.hours_since_publish).toFixed(1)} h ago)` : ""}</dd></div>
        <div><dt className="text-muted-foreground">Last newsroom run</dt><dd>{data.last_run_status ?? "—"} · {fmt(data.last_run_at)}</dd></div>
        <div><dt className="text-muted-foreground">Checked</dt><dd>{fmt(data.checked_at)}{!data.in_active_window ? " (overnight — staleness not flagged)" : ""}</dd></div>
      </dl>
      {data.notes && <p className="mt-2 text-sm text-red-800">{data.notes}</p>}
    </div>
  );
};
