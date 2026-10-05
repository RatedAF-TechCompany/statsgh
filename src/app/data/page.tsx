export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import DataIndicators from "@/views/DataIndicators";

const title = "Data Indicators — Ghana Statistics | StatsGH";
const description =
  "Browse Ghana's economic, financial, and social data indicators — live values, historical trends, and sources.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/data" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://www.statsgh.com/data",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function DataPage() {
  return <DataIndicators />;
}
