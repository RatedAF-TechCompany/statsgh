import { pageMeta } from "@/lib/pageMeta";
import { AdvertisePage } from "@/views/InfoPages";

export const metadata = pageMeta("/advertise", "Advertise", "Advertise with StatsGH: sponsored articles, newsletter sponsorships and display placements, always clearly labelled.");
export default function Page() { return <AdvertisePage />; }
