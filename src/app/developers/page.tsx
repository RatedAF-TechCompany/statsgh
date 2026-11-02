import { pageMeta } from "@/lib/pageMeta";
import { DevelopersPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/developers", "Data API", "Free StatsGH data API: Ghana datasets as JSON or CSV, CC BY 4.0, 60 requests a minute.");
export default function Page() { return <DevelopersPage />; }
