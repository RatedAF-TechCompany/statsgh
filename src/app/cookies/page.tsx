import { pageMeta } from "@/lib/pageMeta";
import { CookiesPage } from "@/views/InfoPages";

export const metadata = pageMeta("/cookies", "Cookies and storage", "The cookies and browser storage StatsGH uses, and why.");
export default function Page() { return <CookiesPage />; }
