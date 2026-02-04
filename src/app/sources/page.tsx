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
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function SourcesPage() {
  return <Sources />;
}
