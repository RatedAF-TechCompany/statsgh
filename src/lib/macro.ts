import { supabase } from "@/integrations/supabase/client";

export type MacroPoint = { series_key: string; period: string; value: number; unit: string; is_projection: boolean; source: string; source_url: string; fetched_at: string };

export async function fetchMacro(keys: string[]): Promise<Record<string, MacroPoint[]>> {
  const { data, error } = await supabase.from("macro_series").select("*").in("series_key", keys).order("period", { ascending: true }).limit(3000);
  if (error) throw error;
  const out: Record<string, MacroPoint[]> = {};
  keys.forEach((k) => (out[k] = []));
  (data || []).forEach((r: any) => out[r.series_key]?.push({ ...r, value: Number(r.value) }));
  return out;
}

export const year = (d: string) => d.slice(0, 4);
/** Latest non-projection point. */
export const latestActual = (s: MacroPoint[] | undefined) => (s || []).filter((p) => !p.is_projection).slice(-1)[0];

/** Merge series into chart rows keyed by year. */
export function byYear(series: Record<string, MacroPoint[]>, keys: string[], from = 1980) {
  const m = new Map<string, Record<string, any>>();
  keys.forEach((k) => (series[k] || []).forEach((p) => {
    if (Number(year(p.period)) < from) return;
    const row = m.get(p.period) || { date: p.period };
    row[k] = p.value;
    m.set(p.period, row);
  }));
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}
