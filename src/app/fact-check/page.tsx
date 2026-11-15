export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import { FactCheckPage } from "@/views/growth/Hubs";
import { Prefetched } from "@/components/ssr/Prefetched";
import { HUBS, hubPrefetch } from "@/lib/articleHub";

export const metadata = pageMeta("/fact-check", "Claims vs data", "StatsGH tests public claims about Ghana's economy against official data. Send a claim to check.");
// Story list rendered on the server so crawlers see it without JavaScript.
export default function Page() { return <Prefetched queries={[hubPrefetch(HUBS.factCheck)]}><FactCheckPage /></Prefetched>; }
