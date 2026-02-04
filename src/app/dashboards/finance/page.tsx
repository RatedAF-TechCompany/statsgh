import { Metadata } from "next";
import GhanaFinanceDashboard from "@/views/GhanaFinanceDashboard";

export const metadata: Metadata = {
  title: "Ghana Finance Dashboard - StatsGH",
  description: "Track Ghana's key financial indicators including exchange rates, inflation, interest rates, and public debt.",
  alternates: {
    canonical: "https://statsgh.com/dashboards/finance",
  },
  openGraph: {
    type: "website",
    title: "Ghana Finance Dashboard - StatsGH",
    description: "Track Ghana's key financial indicators including exchange rates, inflation, interest rates, and public debt.",
    url: "https://statsgh.com/dashboards/finance",
    siteName: "StatsGH",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Ghana Finance Dashboard - StatsGH",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "Ghana Finance Dashboard - StatsGH",
    description: "Track Ghana's key financial indicators including exchange rates, inflation, interest rates, and public debt.",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        alt: "Ghana Finance Dashboard - StatsGH",
      },
    ],
  },
};

export default function FinanceDashboardPage() {
  return <GhanaFinanceDashboard />;
}
