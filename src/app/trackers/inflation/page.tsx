import type { Metadata } from "next";
import InflationTracker from "@/views/InflationTracker";

const title = "Inflation Explainer | StatsGH";
const description = "Ghana's monthly CPI inflation — headline, food and non-food — with sources, a chart over time and what it means for your money.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/trackers/inflation" },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/trackers/inflation", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <InflationTracker />;
}
