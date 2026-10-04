export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import Dashboards from "@/views/Dashboards";

const title = "Dashboards | StatsGH";
const description =
  "Interactive dashboards for Ghana's markets and economy — the stock exchange, finance, and commodity trackers.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/dashboards" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://www.statsgh.com/dashboards",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function DashboardsPage() {
  return <Dashboards />;
}
