// Market data refresh — real, sourced feeds only. Never writes estimates.
// FX: open.er-api.com (hourly). Brent/WTI: FRED daily (EIA). Cocoa: FRED monthly (IMF).
// GSE: handled by gse-scrape.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function fetchT(url: string, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal, headers: { "User-Agent": "StatsGH/1.0 (+https://statsgh.com)" } }); }
  finally { clearTimeout(t); }
}

// Last two valid observations from a FRED series CSV (no key needed).
async function fredLatest(id: string) {
  const res = await fetchT(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`);
  if (!res.ok) throw new Error(`FRED ${id} HTTP ${res.status}`);
  const rows = (await res.text()).trim().split("\n").slice(1)
    .map((l) => l.split(",")).filter(([, v]) => v && v !== "." && !isNaN(Number(v)));
  if (rows.length < 1) throw new Error(`FRED ${id} empty`);
  const [d, v] = rows[rows.length - 1];
  const prev = rows.length > 1 ? Number(rows[rows.length - 2][1]) : null;
  return { date: d, value: Number(v), prev };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const report: Record<string, string> = {};

  // ── FX ──
  try {
    const res = await fetchT("https://open.er-api.com/v6/latest/USD");
    const d = await res.json();
    if (d.result !== "success" || !d.rates?.GHS) throw new Error("no GHS rate");
    const asOf = new Date(d.time_last_update_unix * 1000).toISOString();
    const ghs = d.rates.GHS;
    for (const [base, rate] of [["USD", ghs], ["EUR", ghs / d.rates.EUR], ["GBP", ghs / d.rates.GBP]] as [string, number][]) {
      const { data: prev } = await supabase.from("currency_rates").select("rate, fetched_at")
        .eq("base_currency", base).eq("target_currency", "GHS").eq("source", "open.er-api.com")
        .order("fetched_at", { ascending: false }).limit(1).maybeSingle();
      if (prev && new Date(prev.fetched_at!).getTime() === new Date(asOf).getTime()) { report[`${base}/GHS`] = "unchanged"; continue; }
      const p = prev ? Number(prev.rate) : null;
      await supabase.from("currency_rates").insert({
        base_currency: base, target_currency: "GHS", rate,
        previous_rate: p, change_percent: p ? ((rate - p) / p) * 100 : null,
        source: "open.er-api.com", fetched_at: asOf,
      });
      report[`${base}/GHS`] = `${rate.toFixed(4)} as of ${asOf}`;
    }
  } catch (e) { report.fx = `FAILED: ${(e as Error).message}`; }

  // ── Commodities via FRED ──
  const series = [
    { commodity: "oil_brent", id: "DCOILBRENTEU", unit: "per_barrel", source: "FRED (EIA) DCOILBRENTEU" },
    { commodity: "oil_wti", id: "DCOILWTICO", unit: "per_barrel", source: "FRED (EIA) DCOILWTICO" },
    { commodity: "cocoa", id: "PCOCOUSDM", unit: "per_tonne", source: "FRED (IMF) PCOCOUSDM" },
  ];
  for (const s of series) {
    try {
      const o = await fredLatest(s.id);
      const asOf = new Date(`${o.date}T00:00:00Z`).toISOString();
      const { data: existing } = await supabase.from("commodity_prices").select("id")
        .eq("commodity", s.commodity).eq("source", s.source).eq("fetched_at", asOf).limit(1);
      if (existing && existing.length) { report[s.commodity] = `unchanged (${o.date})`; continue; }
      await supabase.from("commodity_prices").insert({
        commodity: s.commodity, price: o.value, currency: "USD", unit: s.unit,
        previous_close: o.prev, change_percent: o.prev ? ((o.value - o.prev) / o.prev) * 100 : null,
        source: s.source, fetched_at: asOf,
      });
      report[s.commodity] = `${o.value} as of ${o.date}`;
    } catch (e) { report[s.commodity] = `FAILED: ${(e as Error).message}`; }
  }

  // GSE prices are written by gse-scrape (official end-of-day snapshots), not here.
  const now = new Date();
  return json({ success: true, report, timestamp: now.toISOString() });
});
