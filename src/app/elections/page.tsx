export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import { ElectionsPage } from "@/views/growth/Hubs";
import { Prefetched } from "@/components/ssr/Prefetched";
import { HUBS, hubPrefetch } from "@/lib/articleHub";

export const metadata = pageMeta("/elections", "Elections data hub", "StatsGH reporting on Ghana's elections, electoral data and campaign claims in one place.");
// Story list rendered on the server so crawlers see it without JavaScript.
export default function Page() { return <Prefetched queries={[hubPrefetch(HUBS.elections)]}><ElectionsPage /></Prefetched>; }
