export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import Companies from "@/views/Companies";

export const metadata = pageMeta("/companies", "Ghana Stock Exchange listed companies", "Profiles of every GSE-listed company: latest end-of-day share price, sector, and all StatsGH reporting on each company.");
export default function Page() { return <Companies />; }
