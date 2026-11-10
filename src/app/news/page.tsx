export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import News from "@/views/News";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { NEWS_COLUMNS, NEWS_PAGE_SIZE } from "@/lib/newsListing";

const title = "News — Latest Ghana Data Journalism | StatsGH";
const description =
  "Browse the latest data journalism, economic analysis, and breaking news from Ghana. Filter by category.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/news" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://www.statsgh.com/news",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

// First page fetched on the server so crawlers (and first paint) get real story links,
// not an empty shell. A database hiccup falls back to the client-side fetch.
export default async function NewsPage() {
  let initial: { articles: any[]; total: number } | undefined;
  try {
    const { data, error, count } = await createReadOnlyServerClient()
      .from("articles")
      .select(NEWS_COLUMNS, { count: "exact" })
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .range(0, NEWS_PAGE_SIZE - 1);
    if (!error) initial = { articles: data ?? [], total: count ?? 0 };
  } catch {}
  return <News initialData={initial} />;
}
