// Scrapes official Bank of Ghana tables (interbank FX, T-bills, policy rate, interbank interest rate).
// Stores only values read from bog.gov.gh with source URL + fetch time; on failure nothing is overwritten,
// so pages keep showing the last good value with its own date. Callers authenticate via _shared/scheduler-auth.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";

const BOG = "https://www.bog.gov.gh";
const URLS = {
  fx: `${BOG}/treasury-and-the-markets/daily-interbank-fx-rates/`,
  fxHist: `${BOG}/treasury-and-the-markets/historical-interbank-fx-rates/`,
  tbills: `${BOG}/treasury-and-the-markets/treasury-bill-rates/`,
  policy: `${BOG}/monetary-policy/policy-rate-trends/`,
  interbank: `${BOG}/treasury-and-the-markets/interbank-interest-rates/`,
};
const UA = "Mozilla/5.0 (compatible; StatsGH-DataBot/1.0; +https://www.statsgh.com/about)";
const MON: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

const strip = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const num = (s: string) => { const n = parseFloat(String(s).replace(/,/g, "")); return isFinite(n) ? n : null; };
function toDate(s: string): string | null {
  const m = String(s).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m || !MON[m[2].toLowerCase()]) return null;
  return `${m[3]}-${MON[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
}

async function get(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return await r.text();
}
/** Rows of the server-rendered wpDataTable with the given wpdatatable id. */
function tableRows(html: string, wdtId: string): string[][] {
  const m = html.match(new RegExp(`<table[^>]*data-wpdatatable_id="${wdtId}"[\\s\\S]*?</table>`));
  if (!m) throw new Error(`table ${wdtId} not found`);
  const body = m[0].split(/<tbody/i)[1] ?? "";
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1])))
    .filter((r) => r.length > 1);
}
/** wpDataTables server-side ajax (used where the rendered table is not the latest page). */
async function ajaxRows(pageHtml: string, wdtId: string, cols: number, length: number): Promise<string[][]> {
  const nonce = pageHtml.match(new RegExp(`name="wdtNonceFrontendServerSide_${wdtId}" value="([^"]+)"`))?.[1];
  if (!nonce) throw new Error(`nonce for table ${wdtId} not found`);
  const p = new URLSearchParams({ draw: "1", start: "0", length: String(length), "search[value]": "", "order[0][column]": "0", "order[0][dir]": "desc", wdtNonce: nonce });
  for (let i = 0; i < cols; i++) p.set(`columns[${i}][data]`, String(i));
  const r = await fetch(`${BOG}/wp-admin/admin-ajax.php?action=get_wdtable&table_id=${wdtId}`, {
    method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: p, signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error(`ajax ${wdtId} HTTP ${r.status}`);
  const j = await r.json();
  return (j.data || []).map((row: string[]) => row.map(strip));
}

function fxRecords(rows: string[][], source_url: string) {
  return rows.map((r) => ({ rate_date: toDate(r[0]), currency: r[1], pair: r[2], buying: num(r[3]), selling: num(r[4]), mid: num(r[5]), source_url }))
    .filter((r) => r.rate_date && /^[A-Z]{6}$/.test(r.pair) && r.mid !== null && r.mid > 0);
}

// deno-lint-ignore no-explicit-any
const jobs: Record<string, (db: any) => Promise<number>> = {
  async fx(db) {
    const recs = fxRecords(tableRows(await get(URLS.fx), "31"), URLS.fx);
    if (!recs.length) throw new Error("no FX rows parsed");
    const { error } = await db.from("bog_fx_rates").upsert(recs.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: "rate_date,pair" });
    if (error) throw error;
    return recs.length;
  },
  async fx_backfill(db) {
    const html = await get(URLS.fxHist);
    const recs = fxRecords(await ajaxRows(html, "40", 6, 19 * 130), URLS.fxHist)
      .filter((r) => ["USDGHS", "GBPGHS", "EURGHS"].includes(r.pair));
    if (!recs.length) throw new Error("no historical FX rows parsed");
    const { error } = await db.from("bog_fx_rates").upsert(recs, { onConflict: "rate_date,pair", ignoreDuplicates: true });
    if (error) throw error;
    return recs.length;
  },
  async tbills(db) {
    const recs = tableRows(await get(URLS.tbills), "2").map((r) => ({
      issue_date: toDate(r[0]), tender_no: r[1] || null, tenor_days: parseInt(r[2]), discount_rate: num(r[3]), interest_rate: num(r[4]), source_url: URLS.tbills,
    })).filter((r) => r.issue_date && [91, 182, 364].includes(r.tenor_days) && r.interest_rate !== null);
    if (!recs.length) throw new Error("no T-bill rows parsed");
    const { error } = await db.from("bog_tbill_rates").upsert(recs.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: "issue_date,tenor_days" });
    if (error) throw error;
    return recs.length;
  },
  async policy(db) {
    const recs = tableRows(await get(URLS.policy), "103").map((r) => ({
      meeting_no: parseInt(r[0]), mpc_dates: r[1] || null, effective_date: toDate(r[2]), rate: num(r[3]), source_url: URLS.policy,
    })).filter((r) => r.meeting_no > 0 && r.effective_date && r.rate !== null);
    const byNo = new Map(recs.map((r) => [r.meeting_no, r]));
    recs.splice(0, recs.length, ...byNo.values());
    if (recs.length < 10) throw new Error(`only ${recs.length} policy rows parsed`);
    const { error } = await db.from("bog_policy_rates").upsert(recs.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: "meeting_no" });
    if (error) throw error;
    return recs.length;
  },
  async interbank(db) {
    const html = await get(URLS.interbank);
    const recs = (await ajaxRows(html, "69", 3, 120)).map((r) => ({ rate_date: toDate(r[1]), rate: num(r[2]), source_url: URLS.interbank }))
      .filter((r) => r.rate_date && r.rate !== null);
    if (!recs.length) throw new Error("no interbank rows parsed");
    const { error } = await db.from("bog_interbank_rates").upsert(recs.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: "rate_date" });
    if (error) throw error;
    return recs.length;
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = await authorizeCaller(req, db);
  if (!auth.ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const job = new URL(req.url).searchParams.get("job") ?? "all";
  const names = job === "all" ? ["fx", "tbills", "policy", "interbank"] : job.split(",").filter((j) => j in jobs);
  if (!names.length) return new Response(JSON.stringify({ error: "unknown job" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results: Record<string, unknown> = {};
  for (const n of names) {
    try {
      const rows = await jobs[n](db);
      results[n] = { ok: true, rows };
      await db.from("market_scrape_runs").insert({ scraper: `bog_${n}`, status: "success", rows_upserted: rows });
    } catch (e) {
      const msg = e instanceof Error ? e.message : (typeof e === "object" ? JSON.stringify(e) : String(e));
      console.error(`bog_${n} failed:`, msg);
      results[n] = { ok: false, error: msg };
      await db.from("market_scrape_runs").insert({ scraper: `bog_${n}`, status: "failed", error: msg.slice(0, 500) });
    }
  }
  return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
