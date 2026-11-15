import { supabase } from "@/integrations/supabase/client";

export const GSE_URL = "https://gse.com.gh/trading-and-data/";
export const GSE_LABEL = "Ghana Stock Exchange (end-of-day, delayed)";

export type GsePrice = {
  trade_date: string; symbol: string; name: string | null; sector: string | null;
  close: number; previous_close: number | null; change: number | null; change_percent: number | null;
  volume: number | null; value_traded: number | null; year_high: number | null; year_low: number | null;
  source: string; source_url: string;
};
export type GseIndex = { trade_date: string; gse_ci: number | null; gse_fsi: number | null; volume: number | null; market_cap_m: number | null; source: string; source_url: string };

export const sectorOf = (p: { sector: string | null }) => p.sector || "Unclassified";
export const nameOf = (p: { name: string | null; symbol: string }) => p.name || p.symbol;

/** Latest stored trading day's snapshot (all symbols). */
export async function fetchLatestGse(): Promise<GsePrice[]> {
  const { data: d } = await supabase.from("gse_daily_prices").select("trade_date").order("trade_date", { ascending: false }).limit(1);
  const day = d?.[0]?.trade_date;
  if (!day) return [];
  const { data, error } = await supabase.from("gse_daily_prices").select("*").eq("trade_date", day).order("symbol");
  if (error) throw error;
  return (data || []) as unknown as GsePrice[];
}

export async function fetchGseIndex(limit = 120): Promise<GseIndex[]> {
  const { data, error } = await supabase.from("gse_index_daily").select("*").order("trade_date", { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data || []) as unknown as GseIndex[]).reverse();
}

export async function fetchGseHistory(symbol: string): Promise<GsePrice[]> {
  const { data, error } = await supabase.from("gse_daily_prices").select("*").eq("symbol", symbol).order("trade_date", { ascending: true }).limit(1000);
  if (error) throw error;
  return (data || []) as unknown as GsePrice[];
}

/** 30-day move per symbol: latest close vs the first stored close on or after 30 days before that day (one request). */
export async function fetchGse30d(latest: GsePrice[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  if (!latest.length) return out;
  const cutoff = new Date(latest[0].trade_date); cutoff.setDate(cutoff.getDate() - 30);
  const from = cutoff.toISOString().slice(0, 10);
  const base = new Map<string, number>();
  for (let off = 0; off < 20_000; off += 1000) {
    const { data, error } = await supabase.from("gse_daily_prices").select("symbol, trade_date, close").gte("trade_date", from)
      .order("trade_date", { ascending: true }).order("symbol", { ascending: true }).range(off, off + 999);
    if (error) throw error;
    for (const r of (data || []) as { symbol: string; close: number }[]) if (!base.has(r.symbol)) base.set(r.symbol, Number(r.close));
    if (!data || data.length < 1000) break;
  }
  for (const p of latest) { const b = base.get(p.symbol); out[p.symbol] = b && b > 0 ? ((p.close - b) / b) * 100 : null; }
  return out;
}

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
export const ghs = (v: number | null | undefined) => (v == null ? "—" : `GH₵${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const intl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-GB"));
export const changeCls = (v: number | null | undefined) => (v == null || v === 0 ? "text-[#5B5B5B]" : v > 0 ? "text-[#2E7D32]" : "text-[#E3120B]");
