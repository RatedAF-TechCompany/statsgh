export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import CompanyProfile from "@/views/CompanyProfile";
import { Prefetched } from "@/components/ssr/Prefetched";
import { fetchCompanies, fetchCompanyArticles } from "@/lib/companiesData";
import { fetchGseHistory } from "@/lib/gse";

type Row = { name: string; symbol: string } | null;
// Look up an active company by slug. Returns undefined if the lookup itself failed (so we never 404 a real page on a DB error).
async function lookup(slug: string): Promise<Row | undefined> {
  try {
    const { data, error } = await (createReadOnlyServerClient() as any).from("companies").select("name, symbol").eq("slug", slug).eq("is_active", true).maybeSingle();
    return error ? undefined : (data as Row);
  } catch { return undefined; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const data = await lookup(slug);
  if (data === null) return { title: "Page not found | StatsGH", robots: { index: false, follow: true } };
  const n = data ? `${data.name} (${data.symbol})` : slug.toUpperCase();
  return pageMeta(`/companies/${slug}`, `${n}: share price, results and news`, `${n} on the Ghana Stock Exchange: latest end-of-day price, earnings and results timeline, and StatsGH coverage.`);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const co = await lookup(slug);
  // Unknown company address: a real 404 with noindex (same as missing articles), never a soft 200 or a redirect.
  if (co === null) notFound();
  const sym = co?.symbol;
  return (
    <Prefetched queries={[
      { queryKey: ["companies"], queryFn: fetchCompanies },
      ...(sym ? [
        { queryKey: ["gse-hist", sym], queryFn: () => fetchGseHistory(sym) },
        { queryKey: ["co-arts", sym], queryFn: () => fetchCompanyArticles(sym, false) },
        { queryKey: ["co-results", sym], queryFn: () => fetchCompanyArticles(sym, true) },
      ] : []),
    ]}>
      <CompanyProfile />
    </Prefetched>
  );
}
