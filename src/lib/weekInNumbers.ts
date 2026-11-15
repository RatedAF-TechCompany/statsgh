// Week in numbers data. No "use client": shared by the view and its server page (SSR prefetch).
import { supabase } from "@/integrations/supabase/client";

export type Item = {
  article_id: string; slug: string; category_slug: string; title: string; published_at: string;
  label: string; value: string; unit: string | null; context: string | null; views: number;
};
export type Mover = { symbol: string; name: string | null; c0: number; c1: number; pct: number };
export type GseWeek = { from: string; to: string; trading_days: number; ci_start: number | null; ci_end: number | null; gainers: Mover[]; losers: Mover[]; source: string; source_url: string };
export type Week = { week_start: string; week_end: string; items: Item[]; compiled_at: string; gse: GseWeek | null };

export async function fetchWeeks(): Promise<Week[]> {
  const { data, error } = await supabase
    .from("week_in_numbers")
    .select("week_start, week_end, items, compiled_at, gse")
    .order("week_start", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data || []) as unknown as Week[];
}
