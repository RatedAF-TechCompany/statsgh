// Evergreen indicator pages (research plan, 15 Nov 2026, item 4): one canonical URL per
// indicator at /indicators/<slug>, with the latest value, date, change and source in the
// server HTML. Every number is read from a stored row written by an official-data job; nothing
// is estimated. Projections are excluded.
import { cache } from "react";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { BOG_URLS } from "@/lib/bogRates";
import { GSS_INFLATION_URL } from "@/lib/inflation";
import { GSE_URL } from "@/lib/gse";

export type Obs = { date: string; value: number };
export type Indicator = {
  slug: string;
  name: string;
  short: string;
  unit: string;          // shown after the value, e.g. "%" or "GHS per US$"
  dp: number;
  definition: string;    // one plain sentence near the top (snippets and AI answers lift it)
  source: string;
  sourceUrl: string;
  frequency: string;
  nextRelease: string;   // stated pattern only, never an invented date
  related: { label: string; href: string }[];
  vault?: string;        // Data Vault slug for CSV/JSON downloads
  target?: { low: number; high: number; label: string };
  changeUnit: "pct" | "points";
  load: () => Promise<Obs[]>;
};

const sb = () => createReadOnlyServerClient() as any;
const n = (v: unknown) => Number(v);

const bogFx = (pair: string) => async () => {
  const since = new Date(Date.now() - 800 * 864e5).toISOString().slice(0, 10);
  const { data } = await sb().from("bog_fx_rates").select("rate_date, mid").eq("pair", pair).gte("rate_date", since).order("rate_date", { ascending: true }).limit(2000);
  return (data || []).map((r: any) => ({ date: r.rate_date, value: n(r.mid) }));
};
const tbill = (tenor: number) => async () => {
  const { data } = await sb().from("bog_tbill_rates").select("issue_date, interest_rate").eq("tenor_days", tenor).order("issue_date", { ascending: true }).limit(2000);
  return (data || []).map((r: any) => ({ date: r.issue_date, value: n(r.interest_rate) }));
};
const macro = (keys: string[]) => async () => {
  const { data } = await sb().from("macro_series").select("series_key, period, value, is_projection").in("series_key", keys).or("is_projection.is.null,is_projection.eq.false").order("period", { ascending: true }).limit(3000);
  const m = new Map<string, number>();
  // Later keys in `keys` win for the same period (e.g. GSS over IMF for CPI).
  for (const k of keys) for (const r of (data || []).filter((x: any) => x.series_key === k)) m.set(r.period, n(r.value));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
};

const RATES = { label: "Interest rates", href: "/markets/rates" };
const FX = { label: "Cedi exchange rates", href: "/markets/forex" };

export const INDICATORS: Indicator[] = [
  { slug: "inflation-rate", name: "Ghana inflation rate (CPI, year-on-year)", short: "Inflation", unit: "%", dp: 1, changeUnit: "points",
    definition: "Ghana's inflation rate is the percentage change in the Ghana Statistical Service consumer price index over the same month a year earlier.",
    source: "Ghana Statistical Service (earlier months: IMF monthly CPI series)", sourceUrl: GSS_INFLATION_URL, frequency: "Monthly",
    nextRelease: "GSS usually publishes a month's CPI early in the following month.", related: [{ label: "Inflation tracker", href: "/trackers/cpi" }, { label: "Cost of living calculator", href: "/tools/cost-of-living" }],
    vault: "cpi-inflation-annual", target: { low: 6, high: 10, label: "Bank of Ghana medium-term target, 8% ± 2%" }, load: macro(["imf_cpi_m", "gss_cpi_m"]) },
  { slug: "cedi-dollar-exchange-rate", name: "Cedi to US dollar exchange rate (Bank of Ghana)", short: "USD/GHS", unit: "GHS per US$", dp: 4, changeUnit: "pct",
    definition: "The Bank of Ghana interbank mid-rate is the official number of cedis for one US dollar, the midpoint of the Bank's daily buying and selling rates.",
    source: "Bank of Ghana, daily interbank FX rates", sourceUrl: BOG_URLS.fx, frequency: "Daily (business days)", nextRelease: "Published each business day.", related: [FX, { label: "Fuel and cedi tracker", href: "/trackers/fuel-and-cedi" }], vault: "bog-fx-rates", load: bogFx("USDGHS") },
  { slug: "cedi-pound-exchange-rate", name: "Cedi to pound sterling exchange rate (Bank of Ghana)", short: "GBP/GHS", unit: "GHS per £", dp: 4, changeUnit: "pct",
    definition: "The Bank of Ghana interbank mid-rate for sterling is the official number of cedis for one British pound.",
    source: "Bank of Ghana, daily interbank FX rates", sourceUrl: BOG_URLS.fx, frequency: "Daily (business days)", nextRelease: "Published each business day.", related: [FX], vault: "bog-fx-rates", load: bogFx("GBPGHS") },
  { slug: "cedi-euro-exchange-rate", name: "Cedi to euro exchange rate (Bank of Ghana)", short: "EUR/GHS", unit: "GHS per €", dp: 4, changeUnit: "pct",
    definition: "The Bank of Ghana interbank mid-rate for the euro is the official number of cedis for one euro.",
    source: "Bank of Ghana, daily interbank FX rates", sourceUrl: BOG_URLS.fx, frequency: "Daily (business days)", nextRelease: "Published each business day.", related: [FX], vault: "bog-fx-rates", load: bogFx("EURGHS") },
  { slug: "policy-rate", name: "Bank of Ghana policy rate", short: "Policy rate", unit: "%", dp: 1, changeUnit: "points",
    definition: "The policy rate is the rate the Bank of Ghana's Monetary Policy Committee sets to steer borrowing costs and inflation.",
    source: "Bank of Ghana, policy rate trends", sourceUrl: BOG_URLS.policy, frequency: "Per MPC meeting (about every two months)", nextRelease: "Changes only at Monetary Policy Committee meetings; see the release calendar.", related: [RATES, { label: "Release calendar", href: "/calendar" }], vault: "policy-rate",
    load: async () => { const { data } = await sb().from("bog_policy_rates").select("effective_date, rate").order("meeting_no", { ascending: true }).limit(500); return (data || []).map((r: any) => ({ date: r.effective_date, value: n(r.rate) })); } },
  ...([91, 182, 364] as const).map((t): Indicator => ({ slug: `${t}-day-treasury-bill-rate`, name: `Ghana ${t}-day Treasury bill interest rate`, short: `${t}-day T-bill`, unit: "%", dp: 2, changeUnit: "points",
    definition: `The ${t}-day Treasury bill rate is the interest rate the Government of Ghana pays on ${t}-day bills sold at its weekly auction.`,
    source: "Bank of Ghana, Treasury bill rates", sourceUrl: BOG_URLS.tbills, frequency: "Weekly auctions", nextRelease: "Auctions are held weekly; results are published after each auction.", related: [RATES], vault: "treasury-bill-rates", load: tbill(t) })),
  { slug: "interbank-interest-rate", name: "Ghana interbank interest rate", short: "Interbank rate", unit: "%", dp: 2, changeUnit: "points",
    definition: "The interbank rate is the weighted average rate banks in Ghana charge each other for short-term loans, as published by the Bank of Ghana.",
    source: "Bank of Ghana, interbank interest rates", sourceUrl: BOG_URLS.interbank, frequency: "As published by the Bank of Ghana", nextRelease: "Updated when the Bank of Ghana publishes new figures.", related: [RATES], vault: "interbank-rate",
    load: async () => { const { data } = await sb().from("bog_interbank_rates").select("rate_date, rate").order("rate_date", { ascending: true }).limit(1000); return (data || []).map((r: any) => ({ date: r.rate_date, value: n(r.rate) })); } },
  { slug: "gse-composite-index", name: "GSE Composite Index (GSE-CI)", short: "GSE-CI", unit: "points", dp: 2, changeUnit: "pct",
    definition: "The GSE Composite Index tracks the prices of all ordinary shares listed on the Ghana Stock Exchange.",
    source: "Ghana Stock Exchange, end-of-day", sourceUrl: GSE_URL, frequency: "Daily (trading days)", nextRelease: "Updated after each trading day; figures are delayed, not real-time.", related: [{ label: "Ghana Stock Exchange today", href: "/markets/gse" }], vault: "gse-index",
    load: async () => { const { data } = await sb().from("gse_index_daily").select("trade_date, gse_ci").not("gse_ci", "is", null).order("trade_date", { ascending: false }).limit(800); return (data || []).reverse().map((r: any) => ({ date: r.trade_date, value: n(r.gse_ci) })); } },
  { slug: "gdp-growth", name: "Ghana real GDP growth (annual)", short: "GDP growth", unit: "%", dp: 1, changeUnit: "points",
    definition: "Real GDP growth is the annual percentage change in the inflation-adjusted value of everything Ghana produces.",
    source: "World Bank World Development Indicators (outturns only)", sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=GH", frequency: "Annual", nextRelease: "World Bank annual updates; GSS publishes quarterly GDP first.", related: [{ label: "GDP tracker", href: "/trackers/gdp" }], vault: "gdp-growth-annual", load: macro(["wb_gdp"]) },
  { slug: "public-debt-to-gdp", name: "Ghana public debt, % of GDP", short: "Public debt", unit: "% of GDP", dp: 1, changeUnit: "points",
    definition: "General government gross debt as a share of GDP, the IMF World Economic Outlook measure (outturns only; projections excluded).",
    source: "IMF World Economic Outlook", sourceUrl: "https://www.imf.org/en/Publications/WEO", frequency: "Annual", nextRelease: "IMF WEO updates in April and October.", related: [{ label: "Budget and debt dashboard", href: "/dashboards/budget-and-debt" }], vault: "fiscal-and-debt", load: macro(["imf_debt"]) },
  { slug: "brent-crude-oil-price", name: "Brent crude oil price", short: "Brent", unit: "US$ per barrel", dp: 2, changeUnit: "pct",
    definition: "Brent is the international benchmark crude oil price that drives Ghana's fuel import costs and its oil revenue.",
    source: "U.S. EIA via FRED (DCOILBRENTEU)", sourceUrl: "https://fred.stlouisfed.org/series/DCOILBRENTEU", frequency: "Daily, published with a lag of several days", nextRelease: "Updated as EIA publishes.", related: [{ label: "Fuel and cedi tracker", href: "/trackers/fuel-and-cedi" }], vault: "commodity-prices",
    load: async () => { const { data } = await sb().from("commodity_prices").select("price, fetched_at").eq("commodity", "oil_brent").like("source", "FRED%").order("fetched_at", { ascending: true }).limit(2000); const m = new Map<string, number>(); (data || []).forEach((r: any) => m.set(String(r.fetched_at).slice(0, 10), n(r.price))); return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })); } },
  { slug: "gold-price", name: "Gold price (international spot, US$ per ounce)", short: "Gold", unit: "US$ per troy ounce", dp: 2, changeUnit: "pct",
    definition: "The international gold spot price in US dollars per troy ounce; gold is Ghana's largest export. This is not the Ghana Gold Board price.",
    source: "gold-api.com (international spot)", sourceUrl: "https://gold-api.com", frequency: "Daily", nextRelease: "Updated daily.", related: [{ label: "Commodities", href: "/dashboards/commodities" }], vault: "gold-price", load: macro(["gold_usd"]) },
];

export const getIndicator = (slug: string) => INDICATORS.find((i) => i.slug === slug);

export type IndicatorSnapshot = { ind: Indicator; series: Obs[]; last: Obs | null; prev: Obs | null; yearAgo: Obs | null };
export const loadIndicator = cache(async (slug: string): Promise<IndicatorSnapshot | null> => {
  const ind = getIndicator(slug);
  if (!ind) return null;
  const series = await ind.load().catch(() => [] as Obs[]);
  const last = series[series.length - 1] ?? null;
  const prev = series[series.length - 2] ?? null;
  let yearAgo: Obs | null = null;
  if (last) {
    const target = new Date(new Date(last.date).getTime() - 365 * 864e5).toISOString().slice(0, 10);
    for (let i = series.length - 1; i >= 0; i--) if (series[i].date <= target) { yearAgo = series[i]; break; }
    // Only use it if it is within ~45 days of a year earlier (avoids a misleading match for sparse series).
    if (yearAgo && Math.abs(new Date(target).getTime() - new Date(yearAgo.date).getTime()) > 45 * 864e5) yearAgo = null;
  }
  return { ind, series, last, prev, yearAgo };
});

export const fmtVal = (ind: Indicator, v: number) => {
  const s = v.toLocaleString("en-GB", { minimumFractionDigits: ind.dp, maximumFractionDigits: ind.dp });
  return ind.unit === "%" ? `${s}%` : ind.unit.startsWith("GHS per") ? `GH₵${s}` : ind.unit.startsWith("US$") ? `US$${s}` : ind.unit === "% of GDP" ? `${s}% of GDP` : s;
};
export const fmtDate = (d: string, ind?: Indicator) => {
  const dt = new Date(d.length === 10 ? d + "T00:00:00Z" : d);
  if (ind?.frequency === "Annual") return String(dt.getUTCFullYear());
  if (ind?.frequency === "Monthly") return dt.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
export function change(ind: Indicator, a: Obs | null, b: Obs | null): string | null {
  if (!a || !b) return null;
  if (ind.changeUnit === "points") { const d = a.value - b.value; return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(ind.dp === 1 ? 1 : 2)} points`; }
  if (!b.value) return null;
  const p = ((a.value - b.value) / b.value) * 100;
  return `${p > 0 ? "+" : p < 0 ? "−" : "±"}${Math.abs(p).toFixed(2)}%`;
}
