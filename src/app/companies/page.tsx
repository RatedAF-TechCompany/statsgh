export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import { pageMeta } from "@/lib/pageMeta";
import Companies from "@/views/Companies";

export const metadata = pageMeta("/companies", "Ghana Stock Exchange listed companies", "Profiles of every GSE-listed company: latest end-of-day share price, sector, and all StatsGH reporting on each company.");
export default function Page() { return <Companies />; }
