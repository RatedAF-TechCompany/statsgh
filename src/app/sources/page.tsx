import { Metadata } from "next";
import Sources from "@/views/Sources";

export const metadata: Metadata = {
  title: "Data Sources - StatsGH",
  description: "Explore the official data sources used by StatsGH including GSS, Bank of Ghana, and other institutions.",
  alternates: {
    canonical: "https://statsgh.com/sources",
  },
  openGraph: {
    type: "website",
    title: "Data Sources - StatsGH",
    description: "Explore the official data sources used by StatsGH including GSS, Bank of Ghana, and other institutions.",
    url: "https://statsgh.com/sources",
    siteName: "StatsGH",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Data Sources - StatsGH",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "Data Sources - StatsGH",
    description: "Explore the official data sources used by StatsGH including GSS, Bank of Ghana, and other institutions.",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        alt: "Data Sources - StatsGH",
      },
    ],
  },
};

export default function SourcesPage() {
  return <Sources />;
}
