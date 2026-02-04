import { Metadata } from "next";
import Dashboards from "@/views/Dashboards";

export const metadata: Metadata = {
  title: "Dashboards - StatsGH",
  description: "Interactive data dashboards for Ghana's economy, finance, and key indicators.",
  alternates: {
    canonical: "https://statsgh.com/dashboards",
  },
  openGraph: {
    type: "website",
    title: "Dashboards - StatsGH",
    description: "Interactive data dashboards for Ghana's economy, finance, and key indicators.",
    url: "https://statsgh.com/dashboards",
    siteName: "StatsGH",
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function DashboardsPage() {
  return <Dashboards />;
}
