import { pageMeta } from "@/lib/pageMeta";
import { ElectionsPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/elections", "Elections data hub", "StatsGH reporting on Ghana's elections, electoral data and campaign claims in one place.");
export default function Page() { return <ElectionsPage />; }
