import { pageMeta } from "@/lib/pageMeta";
export const dynamic = "force-dynamic"; // personalised/live page: render per request
export const metadata = pageMeta("/editorial-standards", "Editorial Standards", "How StatsGH selects, verifies, sources and corrects data-driven news about Ghana's economy.");
export { default } from "@/views/EditorialStandards";
