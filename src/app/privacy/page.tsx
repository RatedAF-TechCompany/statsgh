import { pageMeta } from "@/lib/pageMeta";
import { PrivacyPage } from "@/views/InfoPages";

export const metadata = pageMeta("/privacy", "Privacy policy", "What personal data StatsGH collects, why, and how to have it deleted.");
export default function Page() { return <PrivacyPage />; }
