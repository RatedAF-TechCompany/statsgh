// Registry of every public dataset StatsGH stores. Rows come straight from our tables;
// nothing here computes or estimates values.
import type { SupabaseClient } from "@supabase/supabase-js";

export const LICENCE = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", attribution: "StatsGH" };

export type Dataset = {
  slug: string;
  title: string;
  description: string;
  source: string;
  sourceUrl: string;
  frequency: string;
  table: string;
  columns: string[];
  dateCol: string;
  filter?: { col: string; op: "eq" | "in"; value: unknown }[];
  /** Preview chart: x = dateCol, y column, optional single-series filter. */
  chart?: { y: string; where?: Record<string, unknown>; label: string };
};

const MACRO_COLS = ["series_key", "period", "value", "unit", "is_projection", "source", "source_url"];

export const DATASETS: Dataset[] = [
  { slug: "bog-fx-rates", title: "Bank of Ghana interbank exchange rates", description: "Daily official interbank buying, selling and mid rates of the cedi against the US dollar, pound sterling and euro.", source: "Bank of Ghana", sourceUrl: "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/", frequency: "Daily (business days)", table: "bog_fx_rates", columns: ["rate_date", "pair", "buying", "selling", "mid", "source_url"], dateCol: "rate_date", chart: { y: "mid", where: { pair: "USDGHS" }, label: "USD/GHS mid rate" } },
  { slug: "treasury-bill-rates", title: "Treasury bill rates (91, 182 and 364-day)", description: "Weekly Government of Ghana treasury bill auction results: discount and interest rates by tenor.", source: "Bank of Ghana", sourceUrl: "https://www.bog.gov.gh/treasury-and-the-markets/treasury-bill-rates/", frequency: "Weekly", table: "bog_tbill_rates", columns: ["issue_date", "tender_no", "tenor_days", "discount_rate", "interest_rate", "source_url"], dateCol: "issue_date", chart: { y: "interest_rate", where: { tenor_days: 91 }, label: "91-day interest rate (%)" } },
  { slug: "policy-rate", title: "Bank of Ghana monetary policy rate", description: "Policy rate decisions by the Bank of Ghana Monetary Policy Committee, with meeting number and effective date.", source: "Bank of Ghana", sourceUrl: "https://www.bog.gov.gh/monetary-policy/policy-rate-trends/", frequency: "Per MPC meeting", table: "bog_policy_rates", columns: ["meeting_no", "mpc_dates", "effective_date", "rate", "source_url"], dateCol: "effective_date", chart: { y: "rate", label: "Policy rate (%)" } },
  { slug: "interbank-rate", title: "Interbank interest rate", description: "Interbank weighted average interest rate published by the Bank of Ghana.", source: "Bank of Ghana", sourceUrl: "https://www.bog.gov.gh/treasury-and-the-markets/interbank-interest-rates/", frequency: "Daily / weekly", table: "bog_interbank_rates", columns: ["rate_date", "rate", "source_url"], dateCol: "rate_date", chart: { y: "rate", label: "Interbank rate (%)" } },
  { slug: "cpi-inflation-monthly", title: "Monthly CPI inflation (headline, food, non-food)", description: "Year-on-year consumer price inflation as published by the Ghana Statistical Service and reported in StatsGH articles; each row links to the article it came from.", source: "Ghana Statistical Service, via StatsGH articles", sourceUrl: "https://statsghana.gov.gh/", frequency: "Monthly", table: "inflation_readings", columns: ["kind", "period", "value", "article_slug", "category_slug", "source_count"], dateCol: "period", chart: { y: "value", where: { kind: "headline" }, label: "Headline inflation (%)" } },
  { slug: "gdp-growth-annual", title: "Annual real GDP growth", description: "Real GDP growth for Ghana from the World Bank (outturns) and the IMF World Economic Outlook (flagged projections).", source: "World Bank WDI; IMF World Economic Outlook", sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=GH", frequency: "Annual", table: "macro_series", columns: MACRO_COLS, dateCol: "period", filter: [{ col: "series_key", op: "in", value: ["wb_gdp", "imf_gdp"] }], chart: { y: "value", where: { series_key: "wb_gdp" }, label: "Real GDP growth, World Bank (%)" } },
  { slug: "cpi-inflation-annual", title: "Annual CPI inflation", description: "Annual consumer price inflation for Ghana from the World Bank and the IMF World Economic Outlook (projections flagged).", source: "World Bank WDI; IMF World Economic Outlook", sourceUrl: "https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=GH", frequency: "Annual", table: "macro_series", columns: MACRO_COLS, dateCol: "period", filter: [{ col: "series_key", op: "in", value: ["wb_cpi", "imf_cpi"] }], chart: { y: "value", where: { series_key: "wb_cpi" }, label: "CPI inflation, World Bank (%)" } },
  { slug: "fiscal-and-debt", title: "Fiscal balance, revenue, spending and public debt", description: "General government revenue, expense and balance (World Bank) and gross debt and overall balance as % of GDP (IMF WEO, projections flagged).", source: "World Bank WDI; IMF World Economic Outlook", sourceUrl: "https://www.imf.org/en/Publications/WEO", frequency: "Annual", table: "macro_series", columns: MACRO_COLS, dateCol: "period", filter: [{ col: "series_key", op: "in", value: ["wb_revenue", "wb_expense", "wb_balance", "imf_balance", "imf_debt"] }], chart: { y: "value", where: { series_key: "imf_debt", is_projection: false }, label: "Gross public debt, % of GDP (IMF)" } },
  { slug: "gse-index", title: "GSE Composite and Financial Stocks indices", description: "End-of-day GSE Composite Index (GSE-CI) and GSE Financial Stocks Index (GSE-FSI), with volume and market capitalisation.", source: "Ghana Stock Exchange (end-of-day)", sourceUrl: "https://gse.com.gh/trading-and-data/", frequency: "Daily (trading days)", table: "gse_index_daily", columns: ["trade_date", "gse_ci", "gse_fsi", "volume", "market_cap_m", "source", "source_url"], dateCol: "trade_date", chart: { y: "gse_ci", label: "GSE Composite Index" } },
  { slug: "gse-equity-prices", title: "GSE equity prices (end-of-day)", description: "Daily closing prices, changes and volumes for every Ghana Stock Exchange listed equity, as stored by StatsGH.", source: "Ghana Stock Exchange (end-of-day)", sourceUrl: "https://gse.com.gh/trading-and-data/", frequency: "Daily (trading days)", table: "gse_daily_prices", columns: ["trade_date", "symbol", "name", "sector", "close", "previous_close", "change", "change_percent", "volume", "value_traded", "source", "source_url"], dateCol: "trade_date", chart: { y: "close", where: { symbol: "MTNGH" }, label: "MTN Ghana close (GH₵)" } },
  { slug: "commodity-prices", title: "Commodity prices: oil and cocoa", description: "Brent and WTI crude oil (US EIA) and cocoa (IMF) prices, each stamped with its source and observation time. International prices, not Ghana-specific.", source: "FRED (U.S. EIA, IMF)", sourceUrl: "https://fred.stlouisfed.org/", frequency: "Daily / monthly", table: "commodity_prices", columns: ["commodity", "price", "currency", "unit", "change_percent", "fetched_at", "source"], dateCol: "fetched_at", chart: { y: "price", where: { commodity: "oil_brent" }, label: "Brent crude (US$/barrel)" } },
  { slug: "gold-price", title: "International gold spot price", description: "International gold spot price in US dollars per troy ounce. Not the Ghana Gold Board price.", source: "gold-api.com (international spot)", sourceUrl: "https://gold-api.com", frequency: "Daily", table: "macro_series", columns: MACRO_COLS, dateCol: "period", filter: [{ col: "series_key", op: "eq", value: "gold_usd" }], chart: { y: "value", label: "Gold, US$/oz" } },
  { slug: "crime-justice-stats", title: "Crime and justice statistics from reporting", description: "Numbers on crime, courts and policing extracted from StatsGH's published Crime & Justice articles, with a link to each article and a confidence label.", source: "StatsGH published articles", sourceUrl: "https://www.statsgh.com/trackers/crime-justice", frequency: "As published", table: "crime_stats", columns: ["published_at", "metric", "label", "value", "unit", "region", "confidence", "article_title", "article_slug", "category_slug"], dateCol: "published_at", filter: [{ col: "is_hidden", op: "eq", value: false }] },
  { slug: "week-in-numbers", title: "Week in numbers", description: "The weekly compilation of key figures from StatsGH stories and the GSE week summary.", source: "StatsGH published articles; Ghana Stock Exchange", sourceUrl: "https://www.statsgh.com/week-in-numbers", frequency: "Weekly (Sunday)", table: "week_in_numbers", columns: ["week_start", "week_end", "items", "gse", "compiled_at"], dateCol: "week_end" },
];

export const getDataset = (slug: string) => DATASETS.find((d) => d.slug === slug);

function base(sb: SupabaseClient, d: Dataset, select: string, opts?: { count?: "exact"; head?: boolean }) {
  let q: any = (sb as any).from(d.table).select(select, opts);
  for (const f of d.filter || []) q = f.op === "eq" ? q.eq(f.col, f.value) : q.in(f.col, f.value as unknown[]);
  return q;
}

export async function datasetMeta(sb: SupabaseClient, d: Dataset) {
  const [{ count }, { data }] = await Promise.all([
    base(sb, d, d.dateCol, { count: "exact", head: true }),
    base(sb, d, d.dateCol).order(d.dateCol, { ascending: false }).limit(1),
  ]);
  return { rows: count ?? 0, lastUpdated: (data?.[0]?.[d.dateCol] as string | undefined) ?? null };
}

/** All rows, oldest first, paged past the 1,000-row cap (max 50,000). */
export async function datasetRows(sb: SupabaseClient, d: Dataset, max = 50000): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let off = 0; off < max; off += 1000) {
    const { data, error } = await base(sb, d, d.columns.join(",")).order(d.dateCol, { ascending: true }).range(off, off + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function toCsv(cols: string[], rows: Record<string, unknown>[]) {
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function citation(d: Dataset, lastUpdated: string | null, accessed = new Date()) {
  const year = (lastUpdated || accessed.toISOString()).slice(0, 4);
  const acc = accessed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `StatsGH. (${year}). ${d.title} [Data set]. StatsGH Data Vault. Original source: ${d.source}. Retrieved ${acc}, from https://www.statsgh.com/data-vault/${d.slug}`;
}
