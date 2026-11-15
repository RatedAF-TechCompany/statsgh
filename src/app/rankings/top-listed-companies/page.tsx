export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import TopListed from "@/views/TopListed";
import { Prefetched } from "@/components/ssr/Prefetched";
import { fetchCompanies } from "@/lib/companiesData";
import { fetchGse30d, fetchLatestGse } from "@/lib/gse";

export const metadata = pageMeta("/rankings/top-listed-companies", "Top GSE-listed companies by 30-day share-price move", "Ghana Stock Exchange listed companies ranked by their share-price change over the last 30 days, from end-of-day data.");
export default async function Page() {
  // Same queries (and keys) as the view, so the ranking table is in the first HTML.
  const latest = await fetchLatestGse().catch(() => null);
  return (
    <Prefetched queries={[
      { queryKey: ["companies"], queryFn: fetchCompanies },
      ...(latest ? [
        { queryKey: ["gse-latest"], queryFn: async () => latest },
        ...(latest.length ? [{ queryKey: ["gse-30d", latest.length], queryFn: () => fetchGse30d(latest) }] : []),
      ] : []),
    ]}>
      <TopListed />
    </Prefetched>
  );
}
