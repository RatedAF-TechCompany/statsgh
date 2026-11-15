export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import { ExplainersPage } from "@/views/growth/Hubs";
import { Prefetched } from "@/components/ssr/Prefetched";
import { HUBS, hubPrefetch } from "@/lib/articleHub";

export const metadata = pageMeta("/explainers", "Explain this number", "Short StatsGH explainers on the numbers behind Ghana's economy: what they measure, who publishes them and why they move.");
// Story list rendered on the server so crawlers see it without JavaScript.
export default function Page() { return <Prefetched queries={[hubPrefetch(HUBS.explainers)]}><ExplainersPage /></Prefetched>; }
