export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/pageMeta";
import GseStock from "@/views/GseStock";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { gseStockSummary } from "@/lib/indicatorSummaries";
import { fetchGseHistory, fetchLatestGse } from "@/lib/gse";
import { fetchHeadlineFx } from "@/lib/bogRates";

type P = { params: Promise<{ symbol: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const s = (await params).symbol.toUpperCase();
  const sum = await gseStockSummary(s);
  const m = pageMeta(`/markets/gse/${s}`, sum?.title ?? `${s} share price on the Ghana Stock Exchange`, sum?.description ?? `End-of-day ${s} share price, daily change, volume, price history and sector peers on the Ghana Stock Exchange.`);
  return sum ? m : { ...m, robots: { index: false, follow: true } };
}
export default async function Page({ params }: P) {
  const symbol = (await params).symbol.toUpperCase();
  const s = await gseStockSummary(symbol);
  // Unknown symbol: real 404, not a 200 noindex shell (soft 404). A database error throws (500, not cached as 404).
  if (!s && (await fetchGseHistory(symbol)).length === 0) notFound();
  return (
    <Prefetched queries={[
      { queryKey: ["gse-hist", symbol], queryFn: () => fetchGseHistory(symbol) },
      { queryKey: ["gse-latest"], queryFn: fetchLatestGse },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <GseStock lead={s?.lead} />
    </Prefetched>
  );
}
