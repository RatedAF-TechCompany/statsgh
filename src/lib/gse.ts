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

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
export const ghs = (v: number | null | undefined) => (v == null ? "—" : `GH₵${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const intl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-GB"));
export const changeCls = (v: number | null | undefined) => (v == null || v === 0 ? "text-[#5B5B5B]" : v > 0 ? "text-[#2E7D32]" : "text-[#E3120B]");
