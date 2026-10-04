export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import EconomicCalendar from "@/views/EconomicCalendar";

export const metadata = pageMeta("/calendar", "Ghana economic and data release calendar", "Upcoming Ghana Statistical Service releases (CPI, GDP), Bank of Ghana policy decisions and weekly T-bill auctions, with sources and .ics downloads.");
export default function Page() { return <EconomicCalendar />; }
