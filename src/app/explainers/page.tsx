import { pageMeta } from "@/lib/pageMeta";
import { ExplainersPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/explainers", "Explain this number", "Short StatsGH explainers on the numbers behind Ghana's economy: what they measure, who publishes them and why they move.");
export default function Page() { return <ExplainersPage />; }
