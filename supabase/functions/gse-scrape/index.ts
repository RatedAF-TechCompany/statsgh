// GSE end-of-day snapshots. Primary: official gse.com.gh "Trading and data" tables (wpDataTables ajax).
// Fallback: dev.kwayisi.org unofficial API. Writes only parsed source values; on failure writes nothing,
// so pages keep the last good snapshot. Callers authenticate via _shared/scheduler-auth.ts.
// ?job=daily (default) | ?job=backfill&days=60
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";

const PAGE = "https://gse.com.gh/trading-and-data/";
const UA = "Mozilla/5.0 (compatible; StatsGH-DataBot/1.0; +https://www.statsgh.com/about)";
const SRC = "Ghana Stock Exchange (gse.com.gh)";

// Reference data: listed company names and sectors (not prices). Unknown symbols keep name null.
const CO: Record<string, [string, string]> = {
  ACCESS: ["Access Bank Ghana", "Banking"], ADB: ["Agricultural Development Bank", "Banking"],
  AGA: ["AngloGold Ashanti", "Mining"], ALLGH: ["Atlantic Lithium", "Mining"], ASG: ["Asante Gold Corporation", "Mining"],
  ALW: ["Aluworks", "Manufacturing"], BOPP: ["Benso Oil Palm Plantation", "Agriculture"], CAL: ["CAL Bank", "Banking"],
  CLYD: ["Clydestone (Ghana)", "Technology"], CMLT: ["Camelot Ghana", "Manufacturing"],
  CPC: ["Cocoa Processing Company", "Manufacturing"], DASPHARMA: ["Dannex Ayrton Starwin", "Pharmaceuticals"],
  DIGICUT: ["Digicut Production & Advertising", "Media"], EGH: ["Ecobank Ghana", "Banking"],
  EGL: ["Enterprise Group", "Insurance"], ETI: ["Ecobank Transnational", "Banking"], FAB: ["First Atlantic Bank", "Banking"],
  FML: ["Fan Milk", "Food & Beverage"], GCB: ["GCB Bank", "Banking"], GGBL: ["Guinness Ghana Breweries", "Food & Beverage"],
  GLD: ["NewGold ETF", "ETF"], GOIL: ["GOIL", "Oil & Gas"], IIL: ["Intravenous Infusions", "Pharmaceuticals"],
  KASA: ["Kasapreko", "Food & Beverage"], MAC: ["Mega African Capital", "Financial Services"],
  MMH: ["Meridian-Marshalls Holdings", "Distribution"], MTNGH: ["MTN Ghana", "Telecommunications"],
  PBC: ["Produce Buying Company", "Agriculture"], RBGH: ["Republic Bank Ghana", "Banking"], SAMBA: ["Samba Foods", "Food & Beverage"],
  SCB: ["Standard Chartered Bank Ghana", "Banking"], SCBPREF: ["Standard Chartered Bank Ghana (Preference)", "Banking"],
  SIC: ["SIC Insurance", "Insurance"], SOGEGH: ["Societe Generale Ghana", "Banking"], TLW: ["Tullow Oil", "Oil & Gas"],
  TOTAL: ["TotalEnergies Marketing Ghana", "Oil & Gas"], UNIL: ["Unilever Ghana", "Consumer Goods"], HORDS: ["Hords", "Manufacturing"],
};

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const num = (s: unknown) => { const t = String(s ?? "").replace(/,/g, "").trim(); if (!t) return null; const n = Number(t); return isFinite(n) ? n : null; };
const dmy = (s: string) => { const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

async function ajax(html: string, id: number, length: number) {
  const nonce = html.match(new RegExp(`name="wdtNonceFrontendEdit_${id}" value="([^"]+)"`))?.[1]
    ?? html.match(new RegExp(`name="wdtNonceFrontendServerSide_${id}" value="([^"]+)"`))?.[1];
  if (!nonce) throw new Error(`nonce ${id} not found`);
  const p = new URLSearchParams({ draw: "1", start: "0", length: String(length), "order[0][column]": "0", "order[0][dir]": "desc", wdtNonce: nonce });
  const r = await fetch(`https://gse.com.gh/wp-admin/admin-ajax.php?action=get_wdtable&table_id=${id}`, {
    method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: p, signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`ajax ${id} HTTP ${r.status}`);
  return ((await r.json()).data || []) as string[][];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = await authorizeCaller(req, db);
  if (!auth.ok) return json({ error: "unauthorized" }, 401);
  const u = new URL(req.url);
  const backfill = u.searchParams.get("job") === "backfill";
  const days = Math.min(Number(u.searchParams.get("days") || 60), 180);
  const report: Record<string, unknown> = { job: backfill ? "backfill" : "daily" };

  let prices: Record<string, unknown>[] = [];
  try {
    const r = await fetch(PAGE, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`page HTTP ${r.status}`);
    const html = await r.text();
    const rows = await ajax(html, 39, backfill ? Math.ceil(days * 0.75) * 45 : 120);
    const dates = [...new Set(rows.map((x) => dmy(x[1])).filter(Boolean))] as string[];
    const keep = new Set(backfill ? dates : dates.sort().reverse().slice(0, 1));
    for (const x of rows) {
      const d = dmy(x[1]); const sym = String(x[2]).replace(/\*/g, "").trim().toUpperCase();
      const close = num(x[8]); const prev = num(x[5]);
      if (!d || !keep.has(d) || !sym || close === null || close <= 0) continue;
      prices.push({
        trade_date: d, symbol: sym, name: CO[sym]?.[0] ?? null, sector: CO[sym]?.[1] ?? null,
        year_high: num(x[3]), year_low: num(x[4]), previous_close: prev, open: num(x[6]), last_trade: num(x[7]),
        close, change: num(x[9]), change_percent: prev && prev > 0 ? Math.round(((close - prev) / prev) * 10000) / 100 : null,
        volume: num(x[12]), value_traded: num(x[13]), source: `${SRC}, end-of-day`, source_url: PAGE,
      });
    }
    const idx = (await ajax(html, 47, backfill ? days : 5)).map((x) => ({
      trade_date: dmy(x[2]), volume: num(x[3]), gse_ci: num(x[4]), market_cap_m: num(x[5]), gse_fsi: num(x[6]),
      source: `${SRC}, end-of-day`, source_url: PAGE,
    })).filter((x) => x.trade_date && (x.gse_ci || x.gse_fsi));
    if (idx.length) {
      const { error } = await db.from("gse_index_daily").upsert(idx, { onConflict: "trade_date" });
      report.index = error ? `FAILED: ${error.message}` : `${idx.length} days, latest ${idx[0].trade_date} GSE-CI ${idx[0].gse_ci}`;
    }
    report.primary = `${prices.length} price rows from gse.com.gh`;
  } catch (e) { report.primary = `FAILED: ${(e as Error).message}`; }

  if (!prices.length && !backfill) {
    try {
      const r = await fetch("https://dev.kwayisi.org/apis/gse/live", { signal: AbortSignal.timeout(25000) });
      const rows = await r.json() as { name: string; price: number; change: number; volume: number }[];
      if (!Array.isArray(rows) || !rows.length) throw new Error("empty");
      const today = new Date().toISOString().slice(0, 10);
      prices = rows.filter((x) => x.name && x.price > 0).map((x) => {
        const prev = x.price - (x.change ?? 0); const sym = x.name.toUpperCase();
        return { trade_date: today, symbol: sym, name: CO[sym]?.[0] ?? null, sector: CO[sym]?.[1] ?? null, close: x.price,
          previous_close: prev, change: x.change, change_percent: prev > 0 ? Math.round((x.change / prev) * 10000) / 100 : null,
          volume: x.volume ?? null, source: "dev.kwayisi.org (unofficial GSE feed), delayed", source_url: "https://dev.kwayisi.org/apis/gse/" };
      });
      report.fallback = `${prices.length} rows from kwayisi`;
    } catch (e) { report.fallback = `FAILED: ${(e as Error).message}`; }
  }

  if (prices.length) {
    for (let i = 0; i < prices.length; i += 500) {
      const { error } = await db.from("gse_daily_prices").upsert(prices.slice(i, i + 500), { onConflict: "trade_date,symbol" });
      if (error) report.write = `FAILED: ${error.message}`;
    }
    // Keep the legacy gse_stocks table (homepage ticker) in sync with the latest snapshot.
    const latest = prices.reduce((m, p) => (String(p.trade_date) > m ? String(p.trade_date) : m), "");
    for (const p of prices.filter((p) => p.trade_date === latest)) {
      await db.from("gse_stocks").update({ current_price: p.close, previous_close: p.previous_close, change_percent: p.change_percent,
        volume: p.volume, last_updated: `${latest}T17:00:00Z` }).eq("symbol", p.symbol === "MTNGH" ? "MTN" : p.symbol);
    }
    report.latest_trade_date = latest;
  }
  await db.from("market_scrape_runs").insert({ scraper: backfill ? "gse_backfill" : "gse", status: prices.length ? "success" : "failed", rows_upserted: prices.length, error: prices.length ? null : JSON.stringify(report) });
  return json({ success: prices.length > 0, report });
});
