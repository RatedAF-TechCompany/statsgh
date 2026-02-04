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
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Dashboards - StatsGH",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "Dashboards - StatsGH",
    description: "Interactive data dashboards for Ghana's economy, finance, and key indicators.",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        alt: "Dashboards - StatsGH",
      },
    ],
  },
};

export default function DashboardsPage() {
  return <Dashboards />;
}
