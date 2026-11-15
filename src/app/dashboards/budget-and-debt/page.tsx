export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import BudgetDebt from "@/views/BudgetDebt";
import { Prefetched } from "@/components/ssr/Prefetched";
import { fetchMacro, BUDGET_DEBT_KEYS } from "@/lib/macro";

export const metadata = pageMeta("/dashboards/budget-and-debt", "Ghana budget and public debt dashboard", "Ghana's public debt-to-GDP, budget balance, and revenue versus expense, from the IMF and World Bank, with charts and CSV.");
export default function Page() {
  return (
    <Prefetched queries={[{ queryKey: ["macro", "budget"], queryFn: () => fetchMacro(BUDGET_DEBT_KEYS) }]}>
      <BudgetDebt />
    </Prefetched>
  );
}
