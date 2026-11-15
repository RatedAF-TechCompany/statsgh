// Server-side summaries for indicator pages: the latest value, its date, the change and the source,
// put into <title>, meta description, the first line of the page and JSON-LD (research plan,
// 15 Nov 2026: "Put the number in the HTML on every data page"). Numbers come only from stored
// rows; when a row is missing the summary falls back to the page's generic wording.
import { cache } from "react";
import { BOG_SOURCE, BOG_URLS, fetchBogFx, fetchPolicy, fetchTbills, latestFx, latestTbill, fmtDay } from "@/lib/bogRates";
import { fetchOfficialCpi, monthLabel, GSS_INFLATION_URL, cpiFreshness } from "@/lib/inflation";
import { fetchBrent, fetchPump } from "@/lib/fuelCedi";
import { fetchCalendar } from "@/lib/calendar";
import { fetchGseHistory, fetchGseIndex, fetchLatestGse, GSE_URL, nameOf } from "@/lib/gse";

const SITE = "https://www.statsgh.com";
export type Summary = { title: string; description: string; lead: string; jsonLd: Record<string, unknown> | null };

const signed = (v: number, dp = 2) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(dp)}`;
const pctCh = (v: number, prev: number | null | undefined) => (prev ? ((v - prev) / prev) * 100 : null);
const num = (v: number, dp: number) => v.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

function dataset(path: string, name: string, description: string, creator: { name: string; url: string }, vars: { name: string; value: number; unitText: string }[], first?: string, last?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url: `${SITE}${path}`,
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: creator.name, url: creator.url },
    publisher: { "@type": "NewsMediaOrganization", "@id": `${SITE}/#organization`, name: "StatsGH", url: SITE },
    ...(first && last ? { temporalCoverage: `${first}/${last}` } : {}),
    ...(last ? { dateModified: last } : {}),
    spatialCoverage: { "@type": "Place", name: "Ghana" },
    variableMeasured: vars.map((v) => ({ "@type": "PropertyValue", name: v.name, value: v.value, unitText: v.unitText })),
  };
}

export const forexSummary = cache(async (): Promise<Summary | null> => {
  const rows = await fetchBogFx(120).catch(() => []);
  const usd = latestFx(rows, "USDGHS");
  if (!usd) return null;
  const gbp = latestFx(rows, "GBPGHS");
  const eur = latestFx(rows, "EURGHS");
  const ch = pctCh(usd.value, usd.prev);
  const day = fmtDay(usd.date);
  const lead = `On ${day} the Bank of Ghana's interbank mid-rate was US$1 = GH₵${num(usd.value, 4)}${ch != null ? ` (${signed(ch)}% on the previous business day)` : ""}${gbp ? `, £1 = GH₵${num(gbp.value, 4)}` : ""}${eur ? ` and €1 = GH₵${num(eur.value, 4)}` : ""}.`;
  return {
    title: `Cedi to dollar today: US$1 = GH₵${num(usd.value, 2)} (${day}), Bank of Ghana rate`,
    description: `${lead} Official BoG rates with 30 and 90-day charts and CSV.`,
    lead,
    jsonLd: dataset("/markets/forex", "Bank of Ghana interbank exchange rates: cedi against the US dollar, pound and euro", "Daily official Bank of Ghana interbank buying, selling and mid-rates for USD/GHS, GBP/GHS and EUR/GHS, stored by StatsGH with the Bank's own dates.",
      { name: BOG_SOURCE, url: BOG_URLS.fx },
      [{ name: "USD/GHS mid-rate", value: usd.value, unitText: "GHS per US$" }, ...(gbp ? [{ name: "GBP/GHS mid-rate", value: gbp.value, unitText: "GHS per £" }] : []), ...(eur ? [{ name: "EUR/GHS mid-rate", value: eur.value, unitText: "GHS per €" }] : [])],
      rows[0]?.rate_date, usd.date),
  };
});

export const ratesSummary = cache(async (): Promise<Summary | null> => {
  const [tb, pol] = await Promise.all([fetchTbills().catch(() => []), fetchPolicy().catch(() => [])]);
  const t91 = latestTbill(tb, 91), t182 = latestTbill(tb, 182), t364 = latestTbill(tb, 364);
  const p = pol[pol.length - 1];
  if (!t91 && !p) return null;
  const parts: string[] = [];
  if (t91) parts.push(`91-day ${num(t91.value, 2)}%${t91.prev != null ? ` (${signed(t91.value - t91.prev)} points)` : ""}`);
  if (t182) parts.push(`182-day ${num(t182.value, 2)}%`);
  if (t364) parts.push(`364-day ${num(t364.value, 2)}%`);
  const tDay = t91 ? fmtDay(t91.date) : null;
  const lead = `${t91 ? `At the auction for bills issued on ${tDay}, Treasury bill interest rates were ${parts.join(", ")}.` : ""}${p ? ` The Bank of Ghana policy rate is ${num(p.rate, 1)}%, effective ${fmtDay(p.effective_date)}${p.mpc_dates ? ` (MPC meeting ${p.mpc_dates})` : ""}.` : ""}`.trim();
  return {
    title: `Ghana T-bill rates: ${t91 ? `91-day ${num(t91.value, 2)}%` : ""}${t364 ? `, 364-day ${num(t364.value, 2)}%` : ""}${tDay ? ` (${tDay})` : ""}${p ? `; policy rate ${num(p.rate, 1)}%` : ""}`,
    description: `${lead} Official Bank of Ghana figures with history and charts.`,
    lead,
    jsonLd: dataset("/markets/rates", "Ghana Treasury bill rates and Bank of Ghana policy rate", "Weekly 91, 182 and 364-day Treasury bill interest rates from Bank of Ghana auction results, and the Bank of Ghana monetary policy rate by MPC meeting.",
      { name: BOG_SOURCE, url: BOG_URLS.tbills },
      [...(t91 ? [{ name: "91-day Treasury bill interest rate", value: t91.value, unitText: "percent" }] : []), ...(t182 ? [{ name: "182-day Treasury bill interest rate", value: t182.value, unitText: "percent" }] : []), ...(t364 ? [{ name: "364-day Treasury bill interest rate", value: t364.value, unitText: "percent" }] : []), ...(p ? [{ name: "Bank of Ghana policy rate", value: p.rate, unitText: "percent" }] : [])],
      tb[0]?.issue_date, t91?.date),
  };
});

export const cpiSummary = cache(async (): Promise<Summary | null> => {
  const pts = await fetchOfficialCpi().catch(() => []);
  const last = pts[pts.length - 1];
  if (!last) return null;
  const prev = pts[pts.length - 2];
  const yearAgo = pts.find((x) => x.period === `${Number(last.period.slice(0, 4)) - 1}${last.period.slice(4)}`);
  const m = monthLabel(last.period);
  const src = last.official ? "Ghana Statistical Service" : "IMF monthly CPI series, built from the GSS index";
  const f = cpiFreshness(last.period);
  const lead = `Ghana's annual consumer price inflation was ${num(last.value, 1)}% in ${m} (${src})${prev ? `, ${last.value > prev.value ? "up from" : last.value < prev.value ? "down from" : "unchanged from"} ${num(prev.value, 1)}% in ${monthLabel(prev.period)}${prev.official || !last.official ? "" : " (IMF series)"}` : ""}${yearAgo ? ` and against ${num(yearAgo.value, 1)}% a year earlier${yearAgo.official ? "" : " in the IMF series"}` : ""}. The Bank of Ghana's medium-term target is 8% ± 2%. The ${f.nextPeriodLabel} figure is due in early ${f.expectedLabel}.`;
  return {
    title: `Ghana inflation rate: ${num(last.value, 1)}% in ${m}${last.official ? " (GSS CPI)" : ""}`,
    description: lead.slice(0, 300),
    lead,
    jsonLd: dataset("/trackers/cpi", "Ghana monthly consumer price inflation (CPI, % year-on-year)", "Monthly headline CPI inflation for Ghana: Ghana Statistical Service releases, with earlier months from the IMF monthly CPI series that matches the GSS rates.",
      { name: "Ghana Statistical Service", url: GSS_INFLATION_URL },
      [{ name: `Headline CPI inflation, ${m}`, value: last.value, unitText: "percent, year-on-year" }],
      pts[0]?.period, last.period),
  };
});

export const fuelSummary = cache(async (): Promise<Summary | null> => {
  const [fx, brent, pump] = await Promise.all([fetchBogFx(14).catch(() => []), fetchBrent().catch(() => []), fetchPump().catch(() => ({ petrol: [], diesel: [] }))]);
  const usd = latestFx(fx, "USDGHS");
  const b = brent[brent.length - 1];
  const pet = pump.petrol[pump.petrol.length - 1];
  const dsl = pump.diesel[pump.diesel.length - 1];
  if (!usd && !b) return null;
  const bits = [
    usd ? `the Bank of Ghana rate was US$1 = GH₵${num(usd.value, 4)} on ${fmtDay(usd.date)}` : null,
    b ? `Brent crude was US$${num(b.value, 2)} a barrel on ${fmtDay(b.date)} (EIA via FRED)` : null,
    pet ? `the latest petrol pump price cited in a StatsGH article was GH₵${num(pet.value, 2)} a litre (${fmtDay(pet.date)})` : null,
    dsl ? `diesel GH₵${num(dsl.value, 2)} (${fmtDay(dsl.date)})` : null,
  ].filter(Boolean);
  const lead = `Latest readings: ${bits.join("; ")}.`;
  return {
    title: `Fuel and cedi tracker: US$1 = GH₵${usd ? num(usd.value, 2) : "—"}${b ? `, Brent US$${num(b.value, 2)}` : ""}${usd ? ` (${fmtDay(usd.date)})` : ""}`,
    description: lead.slice(0, 300),
    lead,
    jsonLd: dataset("/trackers/fuel-and-cedi", "Ghana fuel and cedi tracker", "The cedi against the dollar (Bank of Ghana interbank mid-rate), Brent crude (EIA via FRED) and Ghana petrol and diesel pump prices as cited in StatsGH articles.",
      { name: BOG_SOURCE, url: BOG_URLS.fx },
      [...(usd ? [{ name: "USD/GHS mid-rate", value: usd.value, unitText: "GHS per US$" }] : []), ...(b ? [{ name: "Brent crude spot price", value: b.value, unitText: "US$ per barrel" }] : [])],
      undefined, usd?.date),
  };
});

export const calendarSummary = cache(async (): Promise<Summary | null> => {
  const evs = await fetchCalendar("upcoming").catch(() => []);
  const upcoming = evs.filter((e) => e.date_precision === "week" || new Date(e.scheduled_date) >= new Date(Date.now() - 864e5));
  const next = upcoming[0];
  if (!next) return null;
  const d = (e: typeof next) => `${e.date_precision === "week" ? "week of " : ""}${fmtDay(e.scheduled_date.slice(0, 10))}`;
  const lead = `Next on Ghana's data calendar: ${next.title}, ${d(next)}${upcoming[1] ? `; then ${upcoming[1].title}, ${d(upcoming[1])}` : ""}. Every entry links to its official source.`;
  return {
    title: `Ghana economic calendar: next, ${next.title} (${d(next)})`,
    description: lead.slice(0, 300),
    lead,
    jsonLd: {
      "@context": "https://schema.org", "@type": "ItemList", name: "Ghana economic and data release calendar", url: `${SITE}/calendar`,
      itemListElement: upcoming.slice(0, 20).map((e, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Event", name: e.title, startDate: e.scheduled_date.slice(0, 10), eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode", location: { "@type": "VirtualLocation", url: e.source_url }, organizer: { "@type": "Organization", name: e.source_name || "Official source", url: e.source_url } } })),
    },
  };
});

export const gseSummary = cache(async (): Promise<Summary | null> => {
  const idx = await fetchGseIndex(250).catch(() => []);
  const li = idx[idx.length - 1], pi = idx[idx.length - 2];
  if (!li?.gse_ci) return null;
  const ch = pctCh(li.gse_ci, pi?.gse_ci);
  const day = fmtDay(li.trade_date);
  const lead = `The GSE Composite Index closed at ${num(li.gse_ci, 2)}${ch != null ? ` (${signed(ch)}%)` : ""} on ${day}${li.gse_fsi ? `; the Financial Stocks Index was ${num(li.gse_fsi, 2)}` : ""}. End-of-day figures from the Ghana Stock Exchange.`;
  return {
    title: `GSE Composite Index ${num(li.gse_ci, 2)}${ch != null ? ` (${signed(ch)}%)` : ""} on ${day}: Ghana Stock Exchange today`,
    description: lead,
    lead,
    jsonLd: dataset("/markets/gse", "Ghana Stock Exchange end-of-day index levels and share prices", "Daily GSE Composite Index, GSE Financial Stocks Index and end-of-day share prices for listed companies, stored by StatsGH from Ghana Stock Exchange tables.",
      { name: "Ghana Stock Exchange", url: GSE_URL },
      [{ name: "GSE Composite Index", value: li.gse_ci, unitText: "index points" }, ...(li.gse_fsi ? [{ name: "GSE Financial Stocks Index", value: li.gse_fsi, unitText: "index points" }] : [])],
      idx[0]?.trade_date, li.trade_date),
  };
});

export const gseStockSummary = cache(async (symbol: string): Promise<Summary | null> => {
  const hist = await fetchGseHistory(symbol).catch(() => []);
  const l = hist[hist.length - 1];
  if (!l) return null;
  const day = fmtDay(l.trade_date);
  const name = nameOf(l);
  const lead = `${name} (${symbol}) closed at GH₵${num(Number(l.close), 2)} on ${day}${l.change_percent != null ? ` (${signed(Number(l.change_percent))}%)` : ""}${l.volume ? `, with ${Number(l.volume).toLocaleString("en-GB")} shares traded` : ""}. End-of-day price from the Ghana Stock Exchange.`;
  return {
    title: `${symbol} share price GH₵${num(Number(l.close), 2)} (${day}) on the Ghana Stock Exchange`,
    description: lead,
    lead,
    jsonLd: dataset(`/markets/gse/${symbol}`, `${name} (${symbol}) end-of-day share price`, `Daily closing price, change and volume for ${name} on the Ghana Stock Exchange.`,
      { name: "Ghana Stock Exchange", url: l.source_url || GSE_URL },
      [{ name: `${symbol} closing price`, value: Number(l.close), unitText: "GHS" }],
      hist[0]?.trade_date, l.trade_date),
  };
});
