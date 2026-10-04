export const dynamic = "force-dynamic"; // personalised page: render per request
import type { Metadata } from "next";
import NewsletterPrefs from "@/views/NewsletterPrefs";

export const metadata: Metadata = { title: "Newsletter preferences | StatsGH", robots: { index: false, follow: false } };
export default function Page() { return <NewsletterPrefs />; }
