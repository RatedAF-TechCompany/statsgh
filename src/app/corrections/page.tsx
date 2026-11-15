export const dynamic = "force-dynamic"; // personalised/live page: render per request
import { Metadata } from "next";
import Corrections from "@/views/Corrections";
import { Prefetched } from "@/components/ssr/Prefetched";
import { fetchCorrectionsLog } from "@/lib/correctionsLog";

export const metadata: Metadata = {
  title: "Corrections & Clarifications | StatsGH",
  description:
    "Published corrections and clarifications to StatsGH reporting. We correct errors promptly and visibly.",
  alternates: { canonical: "https://www.statsgh.com/corrections" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: {
    title: "Corrections & Clarifications | StatsGH",
    description:
      "Published corrections and clarifications to StatsGH reporting. We correct errors promptly and visibly.",
    type: "website",
  },
};

export default function CorrectionsPage() {
  return <Prefetched queries={[{ queryKey: ["corrections-log"], queryFn: fetchCorrectionsLog }]}><Corrections /></Prefetched>;
}
