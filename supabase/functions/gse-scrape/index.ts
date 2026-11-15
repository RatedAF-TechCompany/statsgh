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

// Index sanity check (added 15 Nov 2026). On 2 Nov 2026 GSE's own table put the day's volume (503,067) in the GSE-CI
// column and we stored it. Reject a level that moves more than MAX_MOVE from the median of the previous accepted
// values (median, so one bad stored row cannot make the next good day look wrong), or that equals the day's volume.
const MAX_MOVE = 0.20;
type Idx = { trade_date: string | null; volume: number | null; gse_ci: number | null; market_cap_m: number | null; gse_fsi: number | null };
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
function suspect(v: number | null, ref: number[], vol: number | null): string | null {
  if (v === null) return null;
  if (vol !== null && vol > 0 && v === vol) return `equals volume ${vol}`;
  if (!ref.length) return null;
  const m = median(ref); const move = Math.abs(v / m - 1);
  return move > MAX_MOVE ? `${(move * 100).toFixed(1)}% from recent median ${m}` : null;
}

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
    // Daily mode keeps EVERY date in the last ~5 trading days (was: newest date only). The 16:00 GMT run can start
    // before GSE posts the day; keeping only the newest date then skipped that day for good (2, 9 and 11 Nov 2026).
    // Re-upserting already-stored days is harmless: same (trade_date, symbol) key, same GSE figures.
    const rows = await ajax(html, 39, backfill ? Math.ceil(days * 0.75) * 45 : 5 * 45);
    const dates = [...new Set(rows.map((x) => dmy(x[1])).filter(Boolean))] as string[];
    const keep = new Set(backfill ? dates : dates.sort().reverse().slice(0, 5));
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
    const raw: Idx[] = (await ajax(html, 47, backfill ? days : 5)).map((x) => ({
      trade_date: dmy(x[2]), volume: num(x[3]), gse_ci: num(x[4]), market_cap_m: num(x[5]), gse_fsi: num(x[6]),
    })).filter((x) => x.trade_date && (x.gse_ci || x.gse_fsi));
    raw.sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
    const idx: Record<string, unknown>[] = []; const rejected: string[] = [];
    if (raw.length) {
      // Reference: stored values up to 10 days before the oldest incoming row, then each accepted incoming row.
      const from = new Date(Date.parse(String(raw[0].trade_date)) - 10 * 864e5).toISOString().slice(0, 10);
      const { data: stored } = await db.from("gse_index_daily").select("trade_date, gse_ci, gse_fsi")
        .gte("trade_date", from).order("trade_date", { ascending: true });
      const have = new Map((stored || []).map((r) => [String(r.trade_date), r]));
      const refAt = (d: string, k: "gse_ci" | "gse_fsi") => {
        const prev = [...have.values()].filter((r) => String(r.trade_date) < d && r[k] != null).sort((x, y) => String(x.trade_date).localeCompare(String(y.trade_date))).map((r) => Number(r[k]));
        return prev.slice(-5);
      };
      for (const r of raw) {
        const d = String(r.trade_date); const old = have.get(d);
        const badCi = suspect(r.gse_ci, refAt(d, "gse_ci"), r.volume);
        const badFsi = suspect(r.gse_fsi, refAt(d, "gse_fsi"), r.volume);
        if (badCi) rejected.push(`${d} GSE-CI ${r.gse_ci}: ${badCi}`);
        if (badFsi) rejected.push(`${d} GSE-FSI ${r.gse_fsi}: ${badFsi}`);
        // A rejected level keeps the stored value (or stays null if the day is new); other columns still update.
        const row = { trade_date: d, volume: r.volume, market_cap_m: r.market_cap_m,
          gse_ci: badCi ? (old?.gse_ci ?? null) : r.gse_ci, gse_fsi: badFsi ? (old?.gse_fsi ?? null) : r.gse_fsi,
          source: `${SRC}, end-of-day`, source_url: PAGE };
        if (!row.gse_ci && !row.gse_fsi) continue;
        idx.push(row); have.set(d, { trade_date: d, gse_ci: row.gse_ci, gse_fsi: row.gse_fsi });
      }
    }
    if (rejected.length) report.index_rejected = rejected;
    if (idx.length) {
      const { error } = await db.from("gse_index_daily").upsert(idx, { onConflict: "trade_date" });
      const last = idx[idx.length - 1];
      report.index = error ? `FAILED: ${error.message}` : `${idx.length} days, latest ${last.trade_date} GSE-CI ${last.gse_ci}`;
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
  // Log rejected index values even when the run succeeds, so a bad GSE figure is visible in market_scrape_runs.
  await db.from("market_scrape_runs").insert({ scraper: backfill ? "gse_backfill" : "gse", status: prices.length ? "success" : "failed", rows_upserted: prices.length,
    error: !prices.length ? JSON.stringify(report) : report.index_rejected ? JSON.stringify({ index_rejected: report.index_rejected }) : null });
  return json({ success: prices.length > 0, report });
});
