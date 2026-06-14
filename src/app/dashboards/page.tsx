import type { Metadata } from "next";
import Dashboards from "@/views/Dashboards";

const title = "Dashboards | StatsGH";
const description =
  "Interactive dashboards for Ghana's markets and economy — the stock exchange, finance, and commodity trackers.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://statsgh.com/dashboards" },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://statsgh.com/dashboards",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function DashboardsPage() {
  return <Dashboards />;
}
