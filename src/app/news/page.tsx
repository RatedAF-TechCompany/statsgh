import type { Metadata } from "next";
import News from "@/views/News";

const title = "News — Latest Ghana Data Journalism | StatsGH";
const description =
  "Browse the latest data journalism, economic analysis, and breaking news from Ghana. Filter by category.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://statsgh.com/news" },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://statsgh.com/news",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function NewsPage() {
  return <News />;
}
