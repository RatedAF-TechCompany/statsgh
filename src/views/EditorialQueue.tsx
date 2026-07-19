"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Article = {
  id: string;
  title: string;
  seo_description: string | null;
  formula_score: number | null;
  formula_breakdown: any;
  editorial_note: string | null;
  created_at: string;
};

export default function EditorialQueueView() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("articles")
      .select("id,title,seo_description,formula_score,formula_breakdown,editorial_note,created_at")
      .eq("editorial_status", "awaiting_editor")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as any) ?? []);
    const { data: m } = await supabase
      .from("editorial_daily_metrics")
      .select("*")
      .order("date", { ascending: false })
      .limit(7);
    setMetrics(m ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, decision: "publish" | "reject" | "revise") {
    setBusy(id);
    const { error } = await supabase.rpc("editor_decide_article", {
      p_article_id: id, p_decision: decision, p_note: note[id] ?? "",
    });
    setBusy(null);
    if (error) { alert(error.message); return; }
    setItems(items.filter(i => i.id !== id));
  }

  async function runNow(fn: string) {
    setBusy(fn);
    await supabase.functions.invoke(fn, { body: {} });
    setBusy(null);
    load();
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Editorial Queue</h1>
        <div className="flex gap-2 text-sm">
          <button className="border px-3 py-1" disabled={busy!==null} onClick={() => runNow("editorial-tier1")}>Run Tier 1</button>
          <button className="border px-3 py-1" disabled={busy!==null} onClick={() => runNow("editorial-tier2-batch")}>Run Tier 2</button>
          <button className="border px-3 py-1" disabled={busy!==null} onClick={() => runNow("editorial-publish-gate")}>Run Publish Gate</button>
        </div>
      </div>

      {Array.isArray(metrics) && metrics.length > 0 && (
        <div className="border p-4 text-sm">
          <h2 className="font-semibold mb-2">Last 7 days</h2>
          <table className="w-full text-xs">
            <thead><tr className="text-left border-b">
              <th>Date</th><th>Submitted</th><th>T1 rej</th><th>T2 rej</th><th>Auto</th><th>Editor</th><th>Waiting</th><th>Published</th><th>Avg score</th>
            </tr></thead>
            <tbody>
              {metrics.map((m: any) => (
                <tr key={m.date} className="border-b">
                  <td>{m.date}</td>
                  <td>{m.metrics_json?.articles_submitted}</td>
                  <td>{m.metrics_json?.articles_rejected_tier1}</td>
                  <td>{m.metrics_json?.articles_rejected_tier2}</td>
                  <td>{m.metrics_json?.articles_approved_auto}</td>
                  <td>{m.metrics_json?.articles_approved_editor}</td>
                  <td>{m.metrics_json?.articles_awaiting_editor}</td>
                  <td>{m.metrics_json?.articles_published}</td>
                  <td>{m.metrics_json?.avg_formula_score?.toFixed?.(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading ? <p>Loading…</p> : items.length === 0 ? (
        <p className="text-muted-foreground">No articles awaiting editor review.</p>
      ) : (
        <ul className="space-y-4">
          {items.map(a => (
            <li key={a.id} className="border p-4">
              <div className="flex justify-between gap-4">
                <h3 className="font-semibold">{a.title}</h3>
                <span className="text-sm">Score: <b>{a.formula_score ?? "?"}</b></span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{a.seo_description}</p>
              {a.formula_breakdown && (
                <p className="text-xs mt-2 font-mono">
                  {Object.entries(a.formula_breakdown).map(([k, v]) => `${k}:${v}`).join(" · ")}
                </p>
              )}
              {a.editorial_note && <p className="text-xs italic mt-1">Note: {a.editorial_note}</p>}
              <input
                className="border w-full mt-2 px-2 py-1 text-sm"
                placeholder="Optional note / reason"
                value={note[a.id] ?? ""}
                onChange={e => setNote({ ...note, [a.id]: e.target.value })}
              />
              <div className="flex gap-2 mt-2">
                <button className="bg-green-600 text-white px-3 py-1 text-sm" disabled={busy===a.id} onClick={() => decide(a.id,"publish")}>Publish</button>
                <button className="bg-red-600 text-white px-3 py-1 text-sm" disabled={busy===a.id} onClick={() => decide(a.id,"reject")}>Reject</button>
                <button className="border px-3 py-1 text-sm" disabled={busy===a.id} onClick={() => decide(a.id,"revise")}>Request revisions</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
