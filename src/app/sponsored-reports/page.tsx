import { pageMeta } from "@/lib/pageMeta";
import { SponsoredReportsPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/sponsored-reports", "Sponsored data reports", "Commission an independent, clearly labelled StatsGH data report on a Ghanaian sector or policy question.");
export default function Page() { return <SponsoredReportsPage />; }
