import { pageMeta } from "@/lib/pageMeta";
import { NewsletterPage } from "@/views/InfoPages";

export const metadata = pageMeta("/newsletter", "Daily digest newsletter", "Sign up for the StatsGH daily digest of Ghana"s key numbers.");
export default function Page() { return <NewsletterPage />; }
