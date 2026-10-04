export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import Glossary from "@/views/Glossary";

const title = "Glossary of Ghana economic terms | StatsGH";
const description = "Plain-English definitions of CPI, T-bill yields, the policy rate, cedi depreciation, GDP growth, debt-to-GDP and more.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/glossary" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/glossary", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <Glossary />;
}
