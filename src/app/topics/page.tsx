import { Metadata } from "next";
import TopicsContent from "./TopicsContent";

export const metadata: Metadata = {
  title: "Topics - StatsGH",
  description: "Explore Ghana's data by topic. All our data, research, and writing - topic by topic.",
  alternates: {
    canonical: "https://statsgh.com/topics",
  },
  openGraph: {
    type: "website",
    title: "Topics - StatsGH",
    description: "Explore Ghana's data by topic. All our data, research, and writing - topic by topic.",
    url: "https://statsgh.com/topics",
    siteName: "StatsGH",
    images: ["/social/statsgh-og-1200x630.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Topics - StatsGH",
    description: "Explore Ghana's data by topic. All our data, research, and writing - topic by topic.",
    images: ["/social/statsgh-og-1200x630.png"],
  },
};

export default function TopicsPage() {
  return <TopicsContent />;
}
