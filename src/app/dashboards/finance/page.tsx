export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import FinanceHub from "@/views/FinanceHub";

export const metadata = pageMeta("/dashboards/finance", "Ghana finance dashboard", "Cedi rates, T-bills, policy rate, fuel, inflation and commodities: Ghana's money numbers in one place, from official sources.");
export default function Page() { return <FinanceHub />; }
