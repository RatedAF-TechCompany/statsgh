export const dynamic = "force-dynamic"; // live data page: render per request
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import MarketsForex from "@/views/MarketsForex";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { forexSummary } from "@/lib/indicatorSummaries";
import { fetchBogFx, fetchHeadlineFx } from "@/lib/bogRates";
import { fetchLatestGse } from "@/lib/gse";

const FALLBACK = ["Cedi exchange rates today: official Bank of Ghana USD, GBP, EUR", "Official Bank of Ghana interbank cedi rates against the US dollar, pound and euro, with 30/90-day charts, daily change and CSV download."] as const;
export async function generateMetadata(): Promise<Metadata> {
  const s = await forexSummary();
  return pageMeta("/markets/forex", s?.title ?? FALLBACK[0], s?.description ?? FALLBACK[1]);
}
export default async function Page() {
  const s = await forexSummary();
  return (
    <Prefetched queries={[
      { queryKey: ["bog-fx", 120], queryFn: () => fetchBogFx(120) },
      { queryKey: ["gse-latest"], queryFn: fetchLatestGse },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <MarketsForex lead={s?.lead} />
    </Prefetched>
  );
}
