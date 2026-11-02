import { pageMeta } from "@/lib/pageMeta";
import { FellowsPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/fellows", "Data fellows", "The StatsGH data fellows programme for university students in Ghana. Apply online.");
export default function Page() { return <FellowsPage />; }
