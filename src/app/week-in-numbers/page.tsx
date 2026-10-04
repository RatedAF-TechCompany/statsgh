import type { Metadata } from "next";
import WeekInNumbers from "@/views/WeekInNumbers";

const title = "Week in Numbers | StatsGH";
const description = "The week's most-read Ghana stories, each told through its headline number — compiled every Sunday by StatsGH.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/week-in-numbers" },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/week-in-numbers", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <WeekInNumbers />;
}
