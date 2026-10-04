export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import MarketsRates from "@/views/MarketsRates";

export const metadata = pageMeta("/markets/rates", "Ghana T-bill rates, policy rate and interbank rate", "Latest Ghana 91, 182 and 364-day Treasury bill rates, Bank of Ghana policy rate history since 2002 and the interbank interest rate, from official Bank of Ghana data.");
export default function Page() { return <MarketsRates />; }
