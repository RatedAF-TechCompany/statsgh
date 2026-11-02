import { pageMeta } from "@/lib/pageMeta";
import { WhatsAppPage } from "@/views/growth/Hubs";

export const metadata = pageMeta("/whatsapp", "StatsGH on WhatsApp", "Get Ghana's key numbers on WhatsApp. Sign up to hear when the StatsGH channel opens.");
export default function Page() { return <WhatsAppPage />; }
