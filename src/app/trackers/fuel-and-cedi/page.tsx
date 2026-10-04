export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import FuelCediTracker from "@/views/FuelCediTracker";

const title = "Fuel & Cedi Weekly | StatsGH";
const description = "Weekly tracker of the cedi against the dollar, euro and pound, Brent crude, and Ghana petrol and diesel pump prices — from real, sourced data.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/trackers/fuel-and-cedi" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/trackers/fuel-and-cedi", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <FuelCediTracker />;
}
