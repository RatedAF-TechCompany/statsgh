// Inflation data shared by the CPI tracker, the cost-of-living tool and server rendering.
// Headline CPI comes from the Ghana Statistical Service (series gss_cpi_m, written from the GSS
// "Inflation Rate" highlight / CPI bulletin). The IMF monthly series (imf_cpi_m) lags GSS by a
// month or more and is used only for history in months with no stored GSS figure.
import { supabase } from "@/integrations/supabase/client";
import { fetchMacro, type MacroPoint } from "@/lib/macro";

export type Reading = {
  kind: "headline" | "food" | "non_food";
  period: string;
  value: number;
  article_slug: string | null;
  category_slug: string | null;
  article_title: string | null;
  source_count: number;
  extracted_at: string;
};

export async function fetchReadings(): Promise<Reading[]> {
  const { data, error } = await supabase
    .from("inflation_readings")
    .select("kind, period, value, article_slug, category_slug, article_title, source_count, extracted_at")
    .order("period", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, value: Number(r.value) }));
}

export const GSS_INFLATION_URL = "https://www.statsghana.gov.gh/highlights/inflation-rate";
export const GSS_CALENDAR_URL = "https://www.statsghana.gov.gh/";

export type CpiPoint = MacroPoint & { official: boolean };
/** Monthly headline CPI inflation (% y/y): GSS figures where stored, IMF series for earlier months. */
export async function fetchOfficialCpi(): Promise<CpiPoint[]> {
  const m = await fetchMacro(["gss_cpi_m", "imf_cpi_m"]);
  const byPeriod = new Map<string, CpiPoint>();
  for (const p of m.imf_cpi_m || []) byPeriod.set(p.period, { ...p, official: false });
  for (const p of m.gss_cpi_m || []) byPeriod.set(p.period, { ...p, official: true });
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export const monthLabel = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** GSS usually publishes month M's CPI early in month M+1. Flag when the next figure is late. */
export function cpiFreshness(latestPeriod: string, now = new Date()) {
  const d = new Date(latestPeriod + "T00:00:00Z");
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const expectedBy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 15));
  return {
    nextPeriodLabel: monthLabel(nextMonth.toISOString().slice(0, 10)),
    expectedLabel: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    overdue: now > expectedBy,
  };
}
