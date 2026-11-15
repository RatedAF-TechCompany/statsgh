// Company reference data fetchers. No "use client": shared by client views and server pages (SSR prefetch).
import { supabase } from "@/integrations/supabase/client";

export type Company = { slug: string; symbol: string; name: string; sector: string | null; aliases: string[] };

export async function fetchCompanies(): Promise<Company[]> {
  const { data } = await (supabase as any).from("companies").select("slug, symbol, name, sector, aliases").eq("is_active", true).order("name");
  return data || [];
}

export type CompanyArticle = { id: string; title: string; slug: string; category_slug: string; summary: string | null; published_at: string | null; deal_type: string | null };
export async function fetchCompanyArticles(symbol: string, resultsOnly: boolean): Promise<CompanyArticle[]> {
  return ((await (supabase as any).rpc("company_articles", { p_symbol: symbol, p_results_only: resultsOnly, p_limit: 50 })).data || []) as CompanyArticle[];
}

export const DEAL_TYPES: Record<string, string> = {
  m_and_a: "M&A", bond: "Bond issue", eurobond: "Eurobond", ipo: "IPO / listing", capital_raise: "Capital raise", contract: "Large contract",
};

export type Deal = { id: string; title: string; slug: string; category_slug: string; published_at: string | null; deal_type: string; summary: string | null };
export async function fetchDeals(): Promise<Deal[]> {
  const { data } = await (supabase as any).from("articles").select("id, title, slug, category_slug, published_at, deal_type, summary")
    .eq("is_published", true).eq("is_sponsored", false).not("deal_type", "is", null).order("published_at", { ascending: false }).limit(1000);
  return (data || []) as Deal[];
}
