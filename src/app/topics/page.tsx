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
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Topics - StatsGH",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@StatsGH",
    title: "Topics - StatsGH",
    description: "Explore Ghana's data by topic. All our data, research, and writing - topic by topic.",
    images: [
      {
        url: "/social/statsgh-og-1200x630.png",
        alt: "Topics - StatsGH",
      },
    ],
  },
};

export default function TopicsPage() {
  return <TopicsContent />;
}
