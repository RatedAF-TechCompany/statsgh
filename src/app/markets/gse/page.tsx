export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import GseMarket from "@/views/GseMarket";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { gseSummary } from "@/lib/indicatorSummaries";
import { fetchGseIndex, fetchLatestGse } from "@/lib/gse";
import { fetchHeadlineFx } from "@/lib/bogRates";

const FALLBACK = ["Ghana Stock Exchange today: GSE-CI, gainers, losers and share prices", "End-of-day Ghana Stock Exchange data: Composite Index, top gainers and losers, most active stocks, sector breakdown and all share prices with CSV download."] as const;
export async function generateMetadata(): Promise<Metadata> {
  const s = await gseSummary();
  return pageMeta("/markets/gse", s?.title ?? FALLBACK[0], s?.description ?? FALLBACK[1]);
}
export default async function Page() {
  const s = await gseSummary();
  return (
    <Prefetched queries={[
      { queryKey: ["gse-latest"], queryFn: fetchLatestGse },
      { queryKey: ["gse-index"], queryFn: () => fetchGseIndex(250) },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <GseMarket lead={s?.lead} />
    </Prefetched>
  );
}
