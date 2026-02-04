import { Metadata } from "next";
import GhanaStockExchange from "@/views/GhanaStockExchange";

export const metadata: Metadata = {
  title: "Ghana Stock Exchange - StatsGH",
  description: "Track Ghana Stock Exchange (GSE) performance, stock prices, and market trends.",
  alternates: {
    canonical: "https://statsgh.com/dashboards/gse",
  },
  openGraph: {
    type: "website",
    title: "Ghana Stock Exchange - StatsGH",
    description: "Track Ghana Stock Exchange (GSE) performance, stock prices, and market trends.",
    url: "https://statsgh.com/dashboards/gse",
    siteName: "StatsGH",
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function GSEDashboardPage() {
  return <GhanaStockExchange />;
}
