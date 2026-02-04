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
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function FinanceDashboardPage() {
  return <GhanaFinanceDashboard />;
}
