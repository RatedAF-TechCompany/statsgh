// Fuel & cedi data fetchers, shared by the tracker, embeds, the cost-of-living tool and server rendering.
// No "use client": these run on the server (SSR prefetch) and in the browser.
import { supabase } from "@/integrations/supabase/client";

export type Pt = { date: string; value: number };

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Keep the last observation per UTC day. */
const daily = (rows: { t: string; v: number }[]): Pt[] => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.t.slice(0, 10), r.v));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
};

/** Official Bank of Ghana interbank mid-rate history (one point per BoG business day). */
async function fetchBogFxSeries(base: string): Promise<Pt[]> {
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const { data } = await (supabase as any).from("bog_fx_rates").select("rate_date, mid")
    .eq("pair", `${base}GHS`).gte("rate_date", since).order("rate_date", { ascending: true }).limit(1000);
  return (data || []).map((r: any) => ({ date: r.rate_date, value: Number(r.mid) }));
}

export type FxSeries = { points: Pt[]; official: boolean };
/** Official BoG rate first; open.er-api market mid-rate only when no official figure is stored. */
export async function fetchFxPreferBog(base: string): Promise<FxSeries> {
  const bog = await fetchBogFxSeries(base);
  if (bog.length) return { points: bog, official: true };
  return { points: await fetchFx(base), official: false };
}

export async function fetchFx(base: string): Promise<Pt[]> {
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data } = await supabase
    .from("currency_rates")
    .select("rate, fetched_at")
    .eq("base_currency", base)
    .eq("target_currency", "GHS")
    .eq("source", "open.er-api.com")
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: true })
    .limit(1000);
  return daily((data || []).map((r) => ({ t: r.fetched_at as string, v: Number(r.rate) })));
}

export async function fetchBrent(): Promise<Pt[]> {
  const { data } = await supabase
    .from("commodity_prices")
    .select("price, fetched_at, source")
    .eq("commodity", "oil_brent")
    .like("source", "FRED%")
    .order("fetched_at", { ascending: true })
    .limit(1000);
  return daily((data || []).map((r) => ({ t: r.fetched_at as string, v: Number(r.price) })));
}

export type PumpPt = Pt & { slug: string; cat: string; title: string };
const EXCLUDE = /relief|levy|margin|increase|decrease|reduc|cut|rise|hike|change|drop|subsid|tax|difference|gap|per cent|%/i;

export async function fetchPump(): Promise<{ petrol: PumpPt[]; diesel: PumpPt[] }> {
  const { data } = await supabase
    .from("articles")
    .select("slug, category_slug, title, published_at, key_data")
    .eq("is_published", true)
    .or("title.ilike.%fuel%,title.ilike.%petrol%,title.ilike.%diesel%,title.ilike.%pump%")
    .order("published_at", { ascending: true })
    .limit(500);
  const petrol: PumpPt[] = [];
  const diesel: PumpPt[] = [];
  (data || []).forEach((a: any) => {
    const kd = Array.isArray(a.key_data) ? a.key_data : [];
    kd.forEach((k: any) => {
      const label = String(k?.label || "");
      const unit = String(k?.unit || "");
      const text = `${label} ${unit}`;
      if (!/GHS|cedi|GH₵/i.test(unit) || !/litre/i.test(text) || EXCLUDE.test(label)) return;
      const v = parseFloat(String(k?.value ?? "").replace(/[^0-9.]/g, ""));
      if (!isFinite(v) || v < 5 || v > 60) return;
      const pt = { date: String(a.published_at).slice(0, 10), value: v, slug: a.slug, cat: a.category_slug, title: a.title };
      if (/petrol|gasoline/i.test(label)) petrol.push(pt);
      else if (/diesel|gasoil/i.test(label)) diesel.push(pt);
    });
  });
  const dedupe = (arr: PumpPt[]) => {
    const m = new Map<string, PumpPt>();
    arr.forEach((p) => m.set(p.date, p));
    return [...m.values()];
  };
  return { petrol: dedupe(petrol), diesel: dedupe(diesel) };
}

