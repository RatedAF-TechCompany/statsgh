export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import FuelCediTracker from "@/views/FuelCediTracker";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { fuelSummary } from "@/lib/indicatorSummaries";
import { fetchBrent, fetchFxPreferBog, fetchPump } from "@/lib/fuelCedi";
import { fetchHeadlineFx } from "@/lib/bogRates";

const FALLBACK = ["Fuel & Cedi Weekly", "Weekly tracker of the cedi against the dollar, euro and pound, Brent crude, and Ghana petrol and diesel pump prices — from real, sourced data."] as const;
export async function generateMetadata(): Promise<Metadata> {
  const s = await fuelSummary();
  return pageMeta("/trackers/fuel-and-cedi", s?.title ?? FALLBACK[0], s?.description ?? FALLBACK[1]);
}
export default async function Page() {
  const s = await fuelSummary();
  return (
    <Prefetched queries={[
      ...(["USD", "EUR", "GBP"] as const).map((b) => ({ queryKey: ["fct-fx2", b], queryFn: () => fetchFxPreferBog(b) })),
      { queryKey: ["fct-brent"], queryFn: fetchBrent },
      { queryKey: ["fct-pump"], queryFn: fetchPump },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <FuelCediTracker lead={s?.lead} />
    </Prefetched>
  );
}
