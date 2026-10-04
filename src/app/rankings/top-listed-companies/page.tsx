export const dynamic = "force-dynamic"; // live data page: render per request
import { pageMeta } from "@/lib/pageMeta";
import TopListed from "@/views/TopListed";

export const metadata = pageMeta("/rankings/top-listed-companies", "Top GSE-listed companies by 30-day share-price move", "Ghana Stock Exchange listed companies ranked by their share-price change over the last 30 days, from end-of-day data.");
export default function Page() { return <TopListed />; }
