export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import InflationTracker from "@/views/InflationTracker";

export const metadata = pageMeta("/trackers/cpi", "Ghana CPI inflation tracker", "Ghana's CPI inflation: monthly headline, food and non-food readings plus annual inflation since 1960 from the World Bank and IMF, with sources and CSV.");
export default function Page() { return <InflationTracker />; }
