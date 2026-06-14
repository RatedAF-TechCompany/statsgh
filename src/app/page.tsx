import type { Metadata } from "next";
import Home from "@/views/Home";

export const metadata: Metadata = {
  title: "StatsGH – Ghana's Premier Data Journalism Platform",
  description:
    "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
  alternates: { canonical: "https://statsgh.com/" },
};

export default function HomePage() {
  return <Home />;
}
