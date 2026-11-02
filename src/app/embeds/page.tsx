import { pageMeta } from "@/lib/pageMeta";
import { EmbedsPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/embeds", "Embed StatsGH charts", "Free embeddable StatsGH charts for your website: cedi rates, oil and fuel prices.");
export default function Page() { return <EmbedsPage />; }
