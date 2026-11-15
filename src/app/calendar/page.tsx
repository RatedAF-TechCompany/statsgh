export const dynamic = "force-dynamic"; // live data page: render per request
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import EconomicCalendar from "@/views/EconomicCalendar";
import { Prefetched, JsonLd } from "@/components/ssr/Prefetched";
import { calendarSummary } from "@/lib/indicatorSummaries";
import { fetchCalendar } from "@/lib/calendar";
import { fetchHeadlineFx } from "@/lib/bogRates";

const FALLBACK = ["Ghana economic and data release calendar", "Upcoming Ghana Statistical Service releases (CPI, GDP), Bank of Ghana policy decisions and weekly T-bill auctions, with sources and .ics downloads."] as const;
export async function generateMetadata(): Promise<Metadata> {
  const s = await calendarSummary();
  return pageMeta("/calendar", s?.title ?? FALLBACK[0], s?.description ?? FALLBACK[1]);
}
export default async function Page() {
  const s = await calendarSummary();
  return (
    <Prefetched queries={[
      { queryKey: ["calendar", "upcoming"], queryFn: () => fetchCalendar("upcoming") },
      { queryKey: ["headline-fx", "USD,EUR,GBP"], queryFn: () => fetchHeadlineFx(["USD", "EUR", "GBP"]) },
    ]}>
      {s?.jsonLd && <JsonLd data={s.jsonLd} />}
      <EconomicCalendar lead={s?.lead} />
    </Prefetched>
  );
}
