import { pageMeta } from "@/lib/pageMeta";
import { ContactPage } from "@/views/InfoPages";

export const metadata = pageMeta("/contact", "Contact", "Contact the StatsGH team: tips, data requests, corrections and feedback. Email officeofstatsgh@gmail.com.");
export default function Page() { return <ContactPage />; }
