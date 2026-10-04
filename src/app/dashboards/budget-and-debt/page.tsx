export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import BudgetDebt from "@/views/BudgetDebt";

export const metadata = pageMeta("/dashboards/budget-and-debt", "Ghana budget and public debt dashboard", "Ghana's public debt-to-GDP, budget balance, and revenue versus expense, from the IMF and World Bank, with charts and CSV.");
export default function Page() { return <BudgetDebt />; }
