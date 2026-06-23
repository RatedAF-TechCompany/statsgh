import type { Metadata } from "next";
import Topics from "@/views/Topics";

const title = "Topics — Ghana Data by Subject | StatsGH";
const description =
  "Explore Ghana's data and journalism organised by topic — economy, finance, health, energy, agriculture and more.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://statsgh.com/topics" },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://statsgh.com/topics",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function TopicsPage() {
  return <Topics />;
}
