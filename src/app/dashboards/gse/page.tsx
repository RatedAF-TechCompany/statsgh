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
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Ghana Stock Exchange - StatsGH",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "Ghana Stock Exchange - StatsGH",
    description: "Track Ghana Stock Exchange (GSE) performance, stock prices, and market trends.",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        alt: "Ghana Stock Exchange - StatsGH",
      },
    ],
  },
};

export default function GSEDashboardPage() {
  return <GhanaStockExchange />;
}
