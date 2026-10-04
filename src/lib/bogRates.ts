// Official Bank of Ghana figures scraped by the bog-rates-scrape function.
// Every value carries its own date and source URL; nothing is estimated.
import { supabase } from "@/integrations/supabase/client";

export const BOG_SOURCE = "Bank of Ghana";
export const BOG_URLS = {
  fx: "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/",
  tbills: "https://www.bog.gov.gh/treasury-and-the-markets/treasury-bill-rates/",
  policy: "https://www.bog.gov.gh/monetary-policy/policy-rate-trends/",
  interbank: "https://www.bog.gov.gh/treasury-and-the-markets/interbank-interest-rates/",
};

export type FxRow = { rate_date: string; pair: string; buying: number | null; selling: number | null; mid: number; source_url: string; fetched_at: string };
export type TbillRow = { issue_date: string; tender_no: string | null; tenor_days: number; discount_rate: number | null; interest_rate: number; source_url: string };
export type PolicyRow = { meeting_no: number; mpc_dates: string | null; effective_date: string; rate: number; source_url: string };
export type InterbankRow = { rate_date: string; rate: number; source_url: string };

const db = supabase as any;

export const fmtDay = (d: string) =>
  new Date(d + (d.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export async function fetchBogFx(days = 120): Promise<FxRow[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data } = await db.from("bog_fx_rates").select("rate_date,pair,buying,selling,mid,source_url,fetched_at")
    .in("pair", ["USDGHS", "GBPGHS", "EURGHS"]).gte("rate_date", since).order("rate_date", { ascending: true }).limit(2000);
  return (data || []).map((r: any) => ({ ...r, mid: Number(r.mid), buying: r.buying == null ? null : Number(r.buying), selling: r.selling == null ? null : Number(r.selling) }));
}
export async function fetchTbills(): Promise<TbillRow[]> {
  const { data } = await db.from("bog_tbill_rates").select("issue_date,tender_no,tenor_days,discount_rate,interest_rate,source_url")
    .order("issue_date", { ascending: true }).limit(2000);
  return (data || []).map((r: any) => ({ ...r, interest_rate: Number(r.interest_rate), discount_rate: r.discount_rate == null ? null : Number(r.discount_rate) }));
}
export async function fetchPolicy(): Promise<PolicyRow[]> {
  const { data } = await db.from("bog_policy_rates").select("meeting_no,mpc_dates,effective_date,rate,source_url").order("meeting_no", { ascending: true }).limit(500);
  return (data || []).map((r: any) => ({ ...r, rate: Number(r.rate) }));
}
export async function fetchInterbank(): Promise<InterbankRow[]> {
  const { data } = await db.from("bog_interbank_rates").select("rate_date,rate,source_url").order("rate_date", { ascending: true }).limit(1000);
  return (data || []).map((r: any) => ({ ...r, rate: Number(r.rate) }));
}

export type Latest = { value: number; prev: number | null; date: string };
/** Latest and previous observation for one FX pair. */
export function latestFx(rows: FxRow[], pair: string): Latest | null {
  const s = rows.filter((r) => r.pair === pair);
  if (!s.length) return null;
  const l = s[s.length - 1];
  return { value: l.mid, prev: s.length > 1 ? s[s.length - 2].mid : null, date: l.rate_date };
}
export function latestTbill(rows: TbillRow[], tenor: number): Latest | null {
  const s = rows.filter((r) => r.tenor_days === tenor);
  if (!s.length) return null;
  const l = s[s.length - 1];
  return { value: l.interest_rate, prev: s.length > 1 ? s[s.length - 2].interest_rate : null, date: l.issue_date };
}

/** Compact snapshot for the header bar and homepage box. */
export async function fetchBogSnapshot() {
  const [fx, tb, pol] = await Promise.all([
    fetchBogFx(14),
    db.from("bog_tbill_rates").select("issue_date,tenor_days,interest_rate").eq("tenor_days", 91).order("issue_date", { ascending: false }).limit(2),
    db.from("bog_policy_rates").select("effective_date,rate").order("meeting_no", { ascending: false }).limit(1),
  ]);
  const t = tb.data || [];
  const p = (pol.data || [])[0];
  return {
    usd: latestFx(fx, "USDGHS"),
    gbp: latestFx(fx, "GBPGHS"),
    eur: latestFx(fx, "EURGHS"),
    t91: t[0] ? { value: Number(t[0].interest_rate), prev: t[1] ? Number(t[1].interest_rate) : null, date: t[0].issue_date } as Latest : null,
    policy: p ? { value: Number(p.rate), prev: null, date: p.effective_date } as Latest : null,
  };
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
