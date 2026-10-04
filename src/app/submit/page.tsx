export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import SubmitClient from "./SubmitClient";

const title = "Submit Expert Commentary | StatsGH";
const description =
  "Economists, think tanks and researchers: contribute commentary and analysis to StatsGH.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/submit" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: { title, description, url: "https://www.statsgh.com/submit", siteName: "StatsGH" },
};

export default function SubmitPage() {
  return <SubmitClient />;
}
