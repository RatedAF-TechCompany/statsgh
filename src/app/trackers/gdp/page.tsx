export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import GdpTracker from "@/views/GdpTracker";
import { Prefetched } from "@/components/ssr/Prefetched";
import { fetchMacro, GSS_QGDP_KEY } from "@/lib/macro";

export const metadata = pageMeta("/trackers/gdp", "Ghana GDP growth tracker", "Ghana's annual real GDP growth since 1961 from the World Bank and IMF, quarterly growth from the Ghana Statistical Service, with the latest reading, long-run chart and CSV download.");
export default function Page() {
  return (
    <Prefetched queries={[
      { queryKey: ["macro", "gdp-page"], queryFn: () => fetchMacro(["wb_gdp", "imf_gdp"]) },
      { queryKey: ["macro", "wb_gdp", "imf_gdp"], queryFn: () => fetchMacro(["wb_gdp", "imf_gdp"]) },
      { queryKey: ["macro", GSS_QGDP_KEY], queryFn: () => fetchMacro([GSS_QGDP_KEY]) },
    ]}>
      <GdpTracker />
    </Prefetched>
  );
}
