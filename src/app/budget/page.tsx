import { pageMeta } from "@/lib/pageMeta";
import { BudgetPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/budget", "Budget tracker", "Ghana's budget, mid-year review and public debt: StatsGH stories with the data behind them.");
export default function Page() { return <BudgetPage />; }
