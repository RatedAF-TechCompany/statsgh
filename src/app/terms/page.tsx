import { pageMeta } from "@/lib/pageMeta";
import { TermsPage } from "@/views/InfoPages";

export const metadata = pageMeta("/terms", "Terms of use", "Terms for using StatsGH articles, charts and data.");
export default function Page() { return <TermsPage />; }
