export const dynamic = "force-dynamic"; // live data page: render per request
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import MarketsRates from "@/views/MarketsRates";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { ratesSummary } from "@/lib/indicatorSummaries";
import { fetchHeadlineFx, fetchInterbank, fetchPolicy, fetchTbills } from "@/lib/bogRates";

const FALLBACK = ["Ghana T-bill rates, policy rate and interbank rate", "Latest Ghana 91, 182 and 364-day Treasury bill rates, Bank of Ghana policy rate history since 2002 and the interbank interest rate, from official Bank of Ghana data."] as const;
export async function generateMetadata(): Promise<Metadata> {
  const s = await ratesSummary();
  return pageMeta("/markets/rates", s?.title ?? FALLBACK[0], s?.description ?? FALLBACK[1]);
}
export default async function Page() {
  const s = await ratesSummary();
  return (
    <Prefetched queries={[
      { queryKey: ["bog-tbills"], queryFn: fetchTbills },
      { queryKey: ["bog-policy"], queryFn: fetchPolicy },
      { queryKey: ["bog-interbank"], queryFn: fetchInterbank },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <MarketsRates lead={s?.lead} />
    </Prefetched>
  );
}
