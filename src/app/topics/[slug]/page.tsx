import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import TopicDashboardContent from "./TopicDashboardContent";

interface TopicPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Fetch topic data for metadata and page
async function getTopic(slug: string) {
  const supabase = createReadOnlyServerClient();

  const { data: topic, error } = await supabase
    .from("data_topics")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !topic) {
    return null;
  }

  return topic;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopic(slug);

  if (!topic) {
    return {
      title: "Topic Not Found - StatsGH",
    };
  }

  const description = topic.description || `Explore Ghana's ${topic.name.toLowerCase()} data and indicators.`;

  return {
    title: `${topic.name} - StatsGH`,
    description,
    alternates: {
      canonical: `https://statsgh.com/topics/${slug}`,
    },
    openGraph: {
      type: "website",
      title: `${topic.name} - StatsGH`,
      description,
      url: `https://statsgh.com/topics/${slug}`,
      siteName: "StatsGH",
      images: [
        {
          url: "/social/statsgh-og-1200x630.png",
          width: 1200,
          height: 630,
          alt: `${topic.name} - StatsGH`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${topic.name} - StatsGH`,
      description,
      images: [
        {
          url: "/social/statsgh-og-1200x630.png",
          alt: `${topic.name} - StatsGH`,
        },
      ],
    },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const topic = await getTopic(slug);

  if (!topic) {
    notFound();
  }

  return <TopicDashboardContent topic={topic} />;
}
