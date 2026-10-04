import type { Metadata } from "next";
import CostOfLiving from "@/views/CostOfLiving";

const title = "Cost of Living Calculator | StatsGH";
const description = "Estimate how Ghana's latest fuel prices, cedi rate and CPI inflation affect your monthly fuel, food and transport spending — real sourced figures only.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/tools/cost-of-living" },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/tools/cost-of-living", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <CostOfLiving />;
}
