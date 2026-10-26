// Macro data + release calendar refresh. Writes only values read from the source, each with source + URL.
// Jobs: wb (World Bank API), imf (IMF DataMapper / WEO), gold (gold-api.com international spot),
// calendar (GSS release calendar, BoG MPC decisions from bog_policy_rates, weekly BoG T-bill auctions).
// Failures write nothing. Callers authenticate via _shared/scheduler-auth.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";

const UA = "Mozilla/5.0 (compatible; StatsGH-DataBot/1.0; +https://www.statsgh.com/about)";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const get = async (url: string) => { const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${url} HTTP ${r.status}`); return r; };

const WB = [
  ["wb_cpi", "FP.CPI.TOTL.ZG"], ["wb_gdp", "NY.GDP.MKTP.KD.ZG"], ["wb_revenue", "GC.REV.XGRT.GD.ZS"],
  ["wb_expense", "GC.XPN.TOTL.GD.ZS"], ["wb_balance", "GC.NLD.TOTL.GD.ZS"],
];
// Topic dashboards (/dashboards/[slug]); keep in sync with src/lib/topicDashboards.ts. Reserves stored in US$ bn.
const WB_TOPIC: [string, string, string][] = [
  ["wb_exports", "NE.EXP.GNFS.ZS", "% of GDP"],
  ["wb_imports", "NE.IMP.GNFS.ZS", "% of GDP"],
  ["wb_current_account", "BN.CAB.XOKA.GD.ZS", "% of GDP"],
  ["wb_reserves", "FI.RES.TOTL.CD", "US$ bn"],
  ["wb_fuel_exports", "TX.VAL.FUEL.ZS.UN", "% of merchandise exports"],
  ["wb_agri_va", "NV.AGR.TOTL.ZS", "% of GDP"],
  ["wb_agri_jobs", "SL.AGR.EMPL.ZS", "% of employment"],
  ["wb_cereal_yield", "AG.YLD.CREL.KG", "kg per hectare"],
  ["wb_food_index", "AG.PRD.FOOD.XD", "2014-16 = 100"],
  ["wb_elec_access", "EG.ELC.ACCS.ZS", "% of population"],
  ["wb_elec_rural", "EG.ELC.ACCS.RU.ZS", "% of rural population"],
  ["wb_renew_cons", "EG.FEC.RNEW.ZS", "% of final energy"],
  ["wb_renew_elec", "EG.ELC.RNEW.ZS", "% of electricity output"],
  ["wb_unemp", "SL.UEM.TOTL.ZS", "% of labour force"],
  ["wb_youth_unemp", "SL.UEM.1524.ZS", "% of labour force 15-24"],
  ["wb_lfpr", "SL.TLF.CACT.ZS", "% of population 15+"],
  ["wb_vuln_emp", "SL.EMP.VULN.ZS", "% of employment"],
  ["wb_mmr", "SH.STA.MMRT", "per 100,000 live births"],
  ["wb_u5mr", "SH.DYN.MORT", "per 1,000 live births"],
  ["wb_life_exp", "SP.DYN.LE00.IN", "years"],
  ["wb_health_spend", "SH.XPD.CHEX.GD.ZS", "% of GDP"],
  ["wb_prim_enrol", "SE.PRM.ENRR", "%"],
  ["wb_sec_enrol", "SE.SEC.ENRR", "%"],
  ["wb_literacy", "SE.ADT.LITR.ZS", "%"],
  ["wb_edu_spend", "SE.XPD.TOTL.GD.ZS", "% of GDP"],
  ["wb_poverty_intl", "SI.POV.DDAY", "% of population"],
  ["wb_poverty_nat", "SI.POV.NAHC", "% of population"],
  ["wb_water", "SH.H2O.BASW.ZS", "% of population"],
  ["wb_sanitation", "SH.STA.BASS.ZS", "% of population"],
];
const IMF = [
  ["imf_debt", "GGXWDG_NGDP"], ["imf_balance", "GGXCNL_NGDP"], ["imf_revenue", "GGR_NGDP"],
  ["imf_expenditure", "GGX_NGDP"], ["imf_gdp", "NGDP_RPCH"], ["imf_cpi", "PCPIPCH"],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await authorizeCaller(req, db)).ok) return json({ error: "unauthorized" }, 401);
  const jobs = (new URL(req.url).searchParams.get("job") || "wb,imf,imfcpi,gold,calendar").split(",");
  const report: Record<string, string> = {};
  const year = new Date().getUTCFullYear();
  const upsert = async (rows: Record<string, unknown>[]) => {
    const { error } = await db.from("macro_series").upsert(rows, { onConflict: "series_key,period" });
    if (error) throw new Error(error.message);
  };

  if (jobs.includes("wb")) for (const [key, code] of WB) {
    try {
      const url = `https://api.worldbank.org/v2/country/GH/indicator/${code}?format=json&per_page=100`;
      const d = await (await get(url)).json();
      const rows = (d?.[1] || []).filter((x: any) => x.value != null).map((x: any) => ({
        series_key: key, period: `${x.date}-12-31`, value: x.value, unit: "%", source: `World Bank WDI (${code})`,
        source_url: `https://data.worldbank.org/indicator/${code}?locations=GH`,
      }));
      if (!rows.length) throw new Error("no values");
      await upsert(rows); report[key] = `${rows.length} years`;
    } catch (e) { report[key] = `FAILED: ${(e as Error).message}`; }
  }

  if (jobs.includes("wb")) for (const [key, code, unit] of WB_TOPIC) {
    try {
      const url = `https://api.worldbank.org/v2/country/GH/indicator/${code}?format=json&per_page=100`;
      const d = await (await get(url)).json();
      const scale = unit === "US$ bn" ? 1e-9 : 1;
      const rows = (d?.[1] || []).filter((x: any) => x.value != null).map((x: any) => ({
        series_key: key, period: `${x.date}-12-31`, value: x.value * scale, unit, source: `World Bank WDI (${code})`,
        source_url: `https://data.worldbank.org/indicator/${code}?locations=GH`,
      }));
      if (!rows.length) throw new Error("no values");
      await upsert(rows); report[key] = `${rows.length} years`;
    } catch (e) { report[key] = `FAILED: ${(e as Error).message}`; }
  }

  if (jobs.includes("imf")) for (const [key, code] of IMF) {
    try {
      const d = await (await get(`https://www.imf.org/external/datamapper/api/v1/${code}/GHA`)).json();
      const g = d?.values?.[code]?.GHA as Record<string, number> | undefined;
      if (!g) throw new Error("no GHA values");
      const rows = Object.entries(g).filter(([, v]) => typeof v === "number").map(([y, v]) => ({
        series_key: key, period: `${y}-12-31`, value: v, unit: "%", is_projection: Number(y) >= year,
        source: `IMF World Economic Outlook (${code})`, source_url: `https://www.imf.org/external/datamapper/${code}@WEO/GHA`,
      }));
      await upsert(rows); report[key] = `${rows.length} years`;
    } catch (e) { report[key] = `FAILED: ${(e as Error).message}`; }
  }

  // Monthly headline CPI inflation (y/y) for Ghana from the IMF CPI dataset (built from the GSS index).
  if (jobs.includes("imfcpi")) {
    try {
      const url = "https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.STA/CPI/+/GHA.CPI._T.YOY_PCH_PA_PT.M?c%5BTIME_PERIOD%5D=ge:2000-01";
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const times = (d?.data?.structures?.[0]?.dimensions?.observation?.[0]?.values || []).map((v: any) => String(v.value || v.id));
      const obs = Object.values(d?.data?.dataSets?.[0]?.series || {})[0] as any;
      const rows = Object.entries(obs?.observations || {}).map(([i, v]: [string, any]) => {
        const m = /^(\d{4})-M(\d{2})$/.exec(times[Number(i)] || ""); const val = Number(v?.[0]);
        return m && Number.isFinite(val) ? { series_key: "imf_cpi_m", period: `${m[1]}-${m[2]}-01`, value: Math.round(val * 10) / 10, unit: "%",
          source: "IMF CPI dataset (Ghana Statistical Service index), headline y/y", source_url: "https://data.imf.org/en/datasets/IMF.STA:CPI" } : null;
      }).filter(Boolean) as Record<string, unknown>[];
      if (!rows.length) throw new Error("no values");
      await upsert(rows); report.imf_cpi_m = `${rows.length} months`;
    } catch (e) { report.imf_cpi_m = `FAILED: ${(e as Error).message}`; }
  }

  if (jobs.includes("gold")) {
    try {
      const d = await (await get("https://api.gold-api.com/price/XAU")).json();
      if (!(d?.price > 0) || !d.updatedAt) throw new Error("no price");
      await upsert([{ series_key: "gold_usd", period: String(d.updatedAt).slice(0, 10), value: d.price, unit: "USD/oz",
        source: "gold-api.com (international spot price)", source_url: "https://gold-api.com" }]);
      report.gold = `${d.price} as of ${d.updatedAt}`;
    } catch (e) { report.gold = `FAILED: ${(e as Error).message}`; }
  }

  if (jobs.includes("calendar")) {
    const events: Record<string, unknown>[] = [];
    // 1) Ghana Statistical Service release calendar (embedded JSON). Dates are "week N of month".
    try {
      const GSS = "https://statsghana.gov.gh/news-and-events/release-calendar";
      const html = (await (await get(GSS)).text()).replace(/\\"/g, '"');
      const re = /\{"id":"([^"]+)","sequence":\d+,"status":"(\w+)","year":(\d{4}),"month":(\d+),"monthName":"\w+","week":(\d),"title":"([^"]+)","shortCode":(?:"([^"]*)"|null),"frequency":"(\w+)","category":"([\w-]+)","referencePeriod":(?:"([^"]*)"|null)/g;
      let m; let n = 0;
      while ((m = re.exec(html))) {
        const [, id, status, y, mo, wk, title, code, freq, cat, ref] = m;
        const day = Math.min(1 + (Number(wk) - 1) * 7, 28);
        const t = title.replace(/\\u0026/g, "&");
        events.push({
          external_id: `gss-${id}`, title: t, origin: "auto", date_precision: "week",
          description: `Ghana Statistical Service ${freq} release${ref ? ` (${ref})` : ""}. GSS schedules this for week ${wk} of the month; exact day not published.`,
          event_type: "data_release", source_name: "Ghana Statistical Service", source_url: GSS,
          scheduled_date: `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:00:00Z`,
          status: status.toLowerCase() === "released" ? "released" : "upcoming",
          impact_level: /cpi|gdp|mieg/i.test(code || t) ? "high" : cat === "prices" ? "medium" : "low",
          indicator_slug: null, is_recurring: false,
        });
        n++;
      }
      report.gss = `${n} releases`;
    } catch (e) { report.gss = `FAILED: ${(e as Error).message}`; }

    // 2) Past BoG MPC policy-rate decisions (from our stored BoG policy-rate history).
    try {
      const { data } = await db.from("bog_policy_rates").select("*").order("effective_date", { ascending: false }).limit(24);
      for (const r of (data || []) as any[]) {
        const d = r.effective_date;
        if (!d) continue;
        events.push({
          external_id: `bog-mpc-${d}`, title: `Bank of Ghana MPC decision: policy rate ${Number(r.rate).toFixed(1)}%`,
          origin: "auto", date_precision: "exact", event_type: "policy_meeting", source_name: "Bank of Ghana",
          source_url: r.source_url || "https://www.bog.gov.gh/monetary-policy/policy-rate-trends/",
          description: r.mpc_dates ? `MPC meeting ${r.meeting_no ?? ""} (${r.mpc_dates}); rate effective ${d}.` : null,
          scheduled_date: `${d}T12:00:00Z`, status: "released", actual_value: `${Number(r.rate).toFixed(1)}%`, impact_level: "high",
        });
      }
      report.mpc = `${(data || []).length} past decisions`;
    } catch (e) { report.mpc = `FAILED: ${(e as Error).message}`; }

    // 3) Weekly BoG T-bill auctions (held on Fridays), next 8 weeks.
    const now = new Date();
    for (let i = 0, d = new Date(now); i < 8; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 5) continue;
      const ds = d.toISOString().slice(0, 10);
      events.push({
        external_id: `bog-tbill-${ds}`, title: "Treasury bill auction (91, 182, 364-day)", origin: "auto", date_precision: "exact",
        description: "Weekly Government of Ghana T-bill auction, held on Fridays. Public holidays may move it; results appear on our rates page.",
        event_type: "data_release", source_name: "Bank of Ghana", source_url: "https://www.bog.gov.gh/treasury-and-the-markets/treasury-bill-rates/",
        scheduled_date: `${ds}T12:00:00Z`, status: "upcoming", impact_level: "medium", is_recurring: true, recurrence_rule: "weekly",
      });
      i++;
    }
    if (events.length) {
      const { error } = await db.from("economic_calendar").upsert(events, { onConflict: "external_id" });
      report.calendar = error ? `FAILED: ${error.message}` : `${events.length} entries upserted`;
    }
  }
  return json({ success: true, report });
});
