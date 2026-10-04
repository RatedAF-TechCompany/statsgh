// Data Explorer catalogue: every entry points at real stored data only.
import { supabase } from "@/integrations/supabase/client";
import { sourceLabel } from "@/lib/dataProvenance";

export type ExplorerKind = "indicator" | "tracker" | "key-number";
export interface CatalogItem {
  id: string; // stable id used in ?s= links
  kind: ExplorerKind;
  name: string;
  group: string;
  unit: string;
  href?: string; // related page on the site
}
export interface Pt { date: string; value: number }
export interface SeriesData {
  points: Pt[];
  source: string;
  sourceUrl?: string;
  updated: string | null;
  note?: string;
}

const TRACKERS: CatalogItem[] = [
  { id: "fx-USD", kind: "tracker", name: "US dollar to cedi (USD/GHS)", group: "Fuel & Cedi", unit: "GHS", href: "/trackers/fuel-and-cedi" },
  { id: "fx-EUR", kind: "tracker", name: "Euro to cedi (EUR/GHS)", group: "Fuel & Cedi", unit: "GHS", href: "/trackers/fuel-and-cedi" },
  { id: "fx-GBP", kind: "tracker", name: "Pound to cedi (GBP/GHS)", group: "Fuel & Cedi", unit: "GHS", href: "/trackers/fuel-and-cedi" },
  { id: "com-oil_brent", kind: "tracker", name: "Brent crude", group: "Commodities", unit: "USD/barrel", href: "/trackers/fuel-and-cedi" },
  { id: "com-oil_wti", kind: "tracker", name: "WTI crude", group: "Commodities", unit: "USD/barrel" },
  { id: "com-cocoa", kind: "tracker", name: "Cocoa (world price)", group: "Commodities", unit: "USD/tonne" },
  { id: "inf-headline", kind: "tracker", name: "CPI inflation — headline", group: "Inflation", unit: "%", href: "/trackers/cpi" },
  { id: "inf-food", kind: "tracker", name: "CPI inflation — food", group: "Inflation", unit: "%", href: "/trackers/cpi" },
  { id: "inf-non_food", kind: "tracker", name: "CPI inflation — non-food", group: "Inflation", unit: "%", href: "/trackers/cpi" },
];

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i;
const NON_STAT = /\b(date|day|days|time|hour|year|month|edition|anniversary|session|deadline|phone|age)\b/i;
const toNum = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "")));

interface KeyNum { article: any; label: string; value: number; unit: string }
let keyCache: Map<string, KeyNum> | null = null;

async function loadKeyNumbers(): Promise<Map<string, KeyNum>> {
  if (keyCache) return keyCache;
  const { data } = await supabase
    .from("articles")
    .select("id, slug, category_slug, title, published_at, key_data")
    .eq("is_published", true)
    .not("key_data", "is", null)
    .order("published_at", { ascending: false })
    .limit(400);
  const m = new Map<string, KeyNum>();
  (data || []).forEach((a: any) => {
    if (!Array.isArray(a.key_data)) return;
    a.key_data.forEach((k: any, i: number) => {
      const value = toNum(k?.value);
      const unit = String(k?.unit ?? "").trim();
      if (!k?.label || !Number.isFinite(value) || value === 0) return;
      if (NON_STAT.test(k.label) || MONTHS.test(unit) || /^(years?|months?|days?|hours?|weeks?)$/i.test(unit)) return;
      m.set(`kn-${a.slug}-${i}`, { article: a, label: String(k.label), value, unit });
    });
  });
  keyCache = m;
  return m;
}

export async function loadCatalog(): Promise<CatalogItem[]> {
  const [{ data: inds }, keys] = await Promise.all([
    supabase.from("indicators").select("slug, name, unit, unit_display, topic:data_topics(name)").order("name"),
    loadKeyNumbers(),
  ]);
  const indicators: CatalogItem[] = (inds || []).map((i: any) => ({
    id: `ind-${i.slug}`, kind: "indicator", name: i.name, group: i.topic?.name || "Indicators",
    unit: i.unit_display || i.unit || "", href: `/data/${i.slug}`,
  }));
  const keyItems: CatalogItem[] = [...keys.entries()].map(([id, k]) => ({
    id, kind: "key-number", name: `${k.label} — ${k.article.title}`, group: "Article key numbers",
    unit: k.unit, href: `/${k.article.category_slug}/${k.article.slug}`,
  }));
  return [...TRACKERS, ...indicators, ...keyItems];
}

const dayOnly = (iso: string) => iso.slice(0, 10);
function daily(rows: { t: string; v: number }[]): Pt[] {
  const m = new Map<string, number>();
  rows.forEach((r) => Number.isFinite(r.v) && m.set(dayOnly(r.t), r.v));
  return [...m.entries()].sort().map(([date, value]) => ({ date, value }));
}

export async function loadSeries(item: CatalogItem): Promise<SeriesData> {
  const id = item.id;
  if (id.startsWith("fx-")) {
    const { data } = await supabase.from("currency_rates").select("rate, fetched_at")
      .eq("base_currency", id.slice(3)).eq("target_currency", "GHS").eq("source", "open.er-api.com")
      .order("fetched_at", { ascending: false }).limit(1000);
    const pts = daily((data || []).map((r) => ({ t: r.fetched_at as string, v: Number(r.rate) })));
    return { points: pts, source: sourceLabel("open.er-api.com"), sourceUrl: "https://www.exchangerate-api.com", updated: data?.[0]?.fetched_at ?? null };
  }
  if (id.startsWith("com-")) {
    const { data } = await supabase.from("commodity_prices").select("price, fetched_at, source")
      .eq("commodity", id.slice(4)).like("source", "FRED%")
      .order("fetched_at", { ascending: false }).limit(1000);
    const pts = daily((data || []).map((r) => ({ t: r.fetched_at as string, v: Number(r.price) })));
    return { points: pts, source: sourceLabel(data?.[0]?.source), sourceUrl: "https://fred.stlouisfed.org", updated: data?.[0]?.fetched_at ?? null };
  }
  if (id.startsWith("inf-")) {
    const { data } = await supabase.from("inflation_readings").select("period, value, extracted_at")
      .eq("kind", id.slice(4)).order("period", { ascending: true });
    const pts = (data || []).map((r: any) => ({ date: String(r.period).slice(0, 10), value: Number(r.value) }));
    const upd = (data || []).reduce<string | null>((a, r: any) => (!a || r.extracted_at > a ? r.extracted_at : a), null);
    return { points: pts, source: "Ghana Statistical Service figures, as reported in StatsGH articles", sourceUrl: "/trackers/cpi", updated: upd };
  }
  if (id.startsWith("kn-")) {
    const k = (await loadKeyNumbers()).get(id);
    if (!k) return { points: [], source: "—", updated: null };
    let source = "StatsGH article";
    const { data } = await supabase.rpc("get_article_source", { p_article_id: k.article.id });
    const row: any = Array.isArray(data) ? data[0] : data;
    if (row?.source_name) source = row.source_name;
    return {
      points: [{ date: dayOnly(k.article.published_at), value: k.value }],
      source, sourceUrl: row?.source_url || item.href, updated: k.article.published_at,
      note: "A single figure reported in one article — not a time series.",
    };
  }
  // Stored indicator: Ghana series, primary first
  const slug = id.slice(4);
  const { data: ind } = await supabase.from("indicators").select("id").eq("slug", slug).maybeSingle();
  if (!ind) return { points: [], source: "—", updated: null };
  const { data: series } = await supabase.from("data_series")
    .select("id, is_primary, geography:geographies!inner(is_ghana, type)")
    .eq("indicator_id", ind.id).eq("geography.is_ghana", true).eq("geography.type", "country");
  const s = (series || []).sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))[0];
  if (!s) return { points: [], source: "—", updated: null };
  const { data: pts } = await supabase.from("data_points")
    .select("date, value, updated_at, source:data_sources(name, website_url)")
    .eq("series_id", s.id).lte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true }).limit(1000);
  const last: any = pts?.[pts.length - 1];
  const upd = (pts || []).reduce<string | null>((a, r: any) => (!a || r.updated_at > a ? r.updated_at : a), null);
  return {
    points: (pts || []).map((p: any) => ({ date: String(p.date).slice(0, 10), value: Number(p.value) })).filter((p) => Number.isFinite(p.value)),
    source: last?.source?.name || "Source not recorded", sourceUrl: last?.source?.website_url || undefined, updated: upd,
  };
}
