import { pageMeta } from "@/lib/pageMeta";
import { FactCheckPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/fact-check", "Claims vs data", "StatsGH tests public claims about Ghana's economy against official data. Send a claim to check.");
export default function Page() { return <FactCheckPage />; }
