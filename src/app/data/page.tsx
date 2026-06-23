import type { Metadata } from "next";
import DataIndicators from "@/views/DataIndicators";

const title = "Data Indicators — Ghana Statistics | StatsGH";
const description =
  "Browse Ghana's economic, financial, and social data indicators — live values, historical trends, and sources.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://statsgh.com/data" },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://statsgh.com/data",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function DataPage() {
  return <DataIndicators />;
}
