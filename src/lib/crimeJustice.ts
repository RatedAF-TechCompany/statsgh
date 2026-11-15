// Crime & justice tracker data. No "use client": shared by the tracker view and its server page (SSR prefetch).
import { supabase } from "@/integrations/supabase/client";
import { crimeJusticeOrFilter } from "@/lib/sectionMapping";

export type Stat = {
  id: string;
  article_slug: string;
  category_slug: string;
  article_title: string;
  published_at: string;
  metric: "arrests" | "convictions" | "cases" | "amount" | "people";
  label: string;
  context: string | null;
  value: number;
  unit: string | null;
  currency: string | null;
  region: string | null;
  region_source: "explicit" | "inferred" | null;
  confidence: "high" | "medium" | "low";
  confidence_reason: string | null;
  extracted_at: string;
};

export async function fetchStats(): Promise<Stat[]> {
  const { data, error } = await supabase
    .from("crime_stats")
    .select("*")
    .eq("is_hidden", false)
    .order("published_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, value: Number(r.value) }));
}

export async function fetchMonthly(): Promise<{ month: string; stories: number }[]> {
  const { data } = await supabase
    .from("articles")
    .select("published_at")
    .eq("is_published", true)
    .or(crimeJusticeOrFilter())
    .not("published_at", "is", null)
    .order("published_at", { ascending: true })
    .limit(1000);
  const m = new Map<string, number>();
  (data || []).forEach((a: any) => {
    const k = String(a.published_at).slice(0, 7);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([month, stories]) => ({ month, stories }));
}
