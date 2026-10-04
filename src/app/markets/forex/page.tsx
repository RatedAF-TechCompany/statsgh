export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import MarketsForex from "@/views/MarketsForex";

export const metadata = pageMeta("/markets/forex", "Cedi exchange rates today: official Bank of Ghana USD, GBP, EUR", "Official Bank of Ghana interbank cedi rates against the US dollar, pound and euro, with 30/90-day charts, daily change and CSV download.");
export default function Page() { return <MarketsForex />; }
