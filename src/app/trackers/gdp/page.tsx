export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import GdpTracker from "@/views/GdpTracker";

export const metadata = pageMeta("/trackers/gdp", "Ghana GDP growth tracker", "Ghana's annual real GDP growth since 1961 from the World Bank and IMF, with the latest reading, long-run chart and CSV download.");
export default function Page() { return <GdpTracker />; }
