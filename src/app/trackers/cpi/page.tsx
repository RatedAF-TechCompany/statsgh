export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import InflationTracker from "@/views/InflationTracker";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { cpiSummary } from "@/lib/indicatorSummaries";
import { fetchOfficialCpi, fetchReadings } from "@/lib/inflation";
import { fetchMacro } from "@/lib/macro";
import { fetchHeadlineFx } from "@/lib/bogRates";

const FALLBACK = ["Ghana CPI inflation tracker", "Ghana's CPI inflation: monthly headline, food and non-food readings plus annual inflation since 1960 from the World Bank and IMF, with sources and CSV."] as const;
export async function generateMetadata(): Promise<Metadata> {
  const s = await cpiSummary();
  return pageMeta("/trackers/cpi", s?.title ?? FALLBACK[0], s?.description ?? FALLBACK[1]);
}
export default async function Page() {
  const s = await cpiSummary();
  return (
    <Prefetched queries={[
      { queryKey: ["inflation-readings"], queryFn: fetchReadings },
      { queryKey: ["cpi-official"], queryFn: fetchOfficialCpi },
      { queryKey: ["macro", "wb_cpi", "imf_cpi"], queryFn: () => fetchMacro(["wb_cpi", "imf_cpi"]) },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <InflationTracker lead={s?.lead} />
    </Prefetched>
  );
}
