export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import About from "@/views/About";

export const metadata: Metadata = {
  title: "About & Methodology | StatsGH",
  description: "How StatsGH sources and verifies the numbers in its reporting, our corrections policy, and how to contact us.",
  alternates: { canonical: "https://www.statsgh.com/about" },
  openGraph: {
    type: "website",
    title: "About & Methodology | StatsGH",
    description: "How StatsGH sources and verifies numbers, our corrections policy, and contact details.",
    url: "https://www.statsgh.com/about",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function AboutPage() {
  return <About />;
}
