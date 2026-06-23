import type { Metadata } from "next";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import TopicDashboard from "@/views/TopicDashboard";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createReadOnlyServerClient();

  const { data: topic } = await supabase
    .from("data_topics")
    .select("name, description, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!topic) {
    return {
      title: "Topic not found | StatsGH",
      robots: { index: false, follow: true },
    };
  }

  const canonicalUrl = `https://statsgh.com/topics/${topic.slug}`;
  const description =
    topic.description ||
    `Explore Ghana's ${topic.name.toLowerCase()} data, indicators, and related coverage from StatsGH.`;

  return {
    title: `${topic.name} — Ghana Data | StatsGH`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      title: `${topic.name} — Ghana Data | StatsGH`,
      description,
      url: canonicalUrl,
      siteName: "StatsGH",
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${topic.name} — Ghana Data | StatsGH`,
      description,
    },
  };
}

export default function TopicPage() {
  return <TopicDashboard />;
}
