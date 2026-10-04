import { Metadata } from "next";
import Corrections from "@/views/Corrections";

export const metadata: Metadata = {
  title: "Corrections & Clarifications | StatsGH",
  description:
    "Published corrections and clarifications to StatsGH reporting. We correct errors promptly and visibly.",
  alternates: { canonical: "https://www.statsgh.com/corrections" },
  openGraph: {
    title: "Corrections & Clarifications | StatsGH",
    description:
      "Published corrections and clarifications to StatsGH reporting. We correct errors promptly and visibly.",
    type: "website",
  },
};

export default function CorrectionsPage() {
  return <Corrections />;
}
