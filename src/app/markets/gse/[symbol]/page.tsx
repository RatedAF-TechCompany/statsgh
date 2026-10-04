export const dynamic = "force-dynamic"; // live data page: render per request
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import GseStock from "@/views/GseStock";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const s = (await params).symbol.toUpperCase();
  return pageMeta(`/markets/gse/${s}`, `${s} share price on the Ghana Stock Exchange`, `End-of-day ${s} share price, daily change, volume, price history and sector peers on the Ghana Stock Exchange.`);
}
export default function Page() { return <GseStock />; }
