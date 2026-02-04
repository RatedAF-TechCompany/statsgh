import { Metadata } from "next";
import DataIndicators from "@/views/DataIndicators";

export const metadata: Metadata = {
  title: "Data Indicators - StatsGH",
  description: "Explore Ghana's key economic, social, and demographic indicators with interactive data visualizations.",
  alternates: {
    canonical: "https://statsgh.com/data",
  },
  openGraph: {
    type: "website",
    title: "Data Indicators - StatsGH",
    description: "Explore Ghana's key economic, social, and demographic indicators with interactive data visualizations.",
    url: "https://statsgh.com/data",
    siteName: "StatsGH",
    images: ["/social/statsgh-og-1200x630.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Data Indicators - StatsGH",
    description: "Explore Ghana's key economic, social, and demographic indicators with interactive data visualizations.",
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function DataPage() {
  return <DataIndicators />;
}
