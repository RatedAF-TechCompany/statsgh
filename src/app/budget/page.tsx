export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import { BudgetPage } from "@/views/growth/Hubs";
import { Prefetched } from "@/components/ssr/Prefetched";
import { HUBS, hubPrefetch } from "@/lib/articleHub";

export const metadata = pageMeta("/budget", "Budget tracker", "Ghana's budget, mid-year review and public debt: StatsGH stories with the data behind them.");
// Story list rendered on the server so crawlers see it without JavaScript.
export default function Page() { return <Prefetched queries={[hubPrefetch(HUBS.budget)]}><BudgetPage /></Prefetched>; }
