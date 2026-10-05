export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import GseMarket from "@/views/GseMarket";

export const metadata = pageMeta("/markets/gse", "Ghana Stock Exchange today: GSE-CI, gainers, losers and share prices", "End-of-day Ghana Stock Exchange data: Composite Index, top gainers and losers, most active stocks, sector breakdown and all share prices with CSV download.");
export default function Page() { return <GseMarket />; }
