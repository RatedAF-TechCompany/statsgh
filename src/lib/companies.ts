"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Company = { slug: string; symbol: string; name: string; sector: string | null; aliases: string[] };

export async function fetchCompanies(): Promise<Company[]> {
  const { data } = await (supabase as any).from("companies").select("slug, symbol, name, sector, aliases").eq("is_active", true).order("name");
  return data || [];
}

export function useCompanies(): Company[] {
  const q = useQuery({ queryKey: ["companies"], queryFn: fetchCompanies, staleTime: 3600_000 });
  return q.data || [];
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Links the first mention of each listed company in article HTML text (never inside tags or existing links). */
export function linkCompanies(html: string, companies: Company[]): string {
  if (!companies.length) return html;
  const map = new Map<string, Company>();
  for (const c of companies) for (const a of c.aliases || []) if (a.length >= 3) map.set(a.toLowerCase(), c);
  if (!map.size) return html;
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(escRe);
  const re = new RegExp(`\\b(${keys.join("|")})\\b`, "gi");
  const done = new Set<string>();
  let inLink = 0;
  return html.split(/(<[^>]+>)/g).map((part) => {
    if (part.startsWith("<")) {
      if (/^<a[\s>]/i.test(part)) inLink++;
      else if (/^<\/a>/i.test(part)) inLink = Math.max(0, inLink - 1);
      return part;
    }
    if (inLink) return part;
    return part.replace(re, (m) => {
      const c = map.get(m.toLowerCase());
      if (!c || done.has(c.symbol)) return m;
      done.add(c.symbol);
      return `<a href="/companies/${c.slug}" class="company-link" title="${c.name} (${c.symbol}) company profile">${m}</a>`;
    });
  }).join("");
}

export const DEAL_TYPES: Record<string, string> = {
  m_and_a: "M&A", bond: "Bond issue", eurobond: "Eurobond", ipo: "IPO / listing", capital_raise: "Capital raise", contract: "Large contract",
};
