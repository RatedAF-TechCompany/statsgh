import { Metadata } from "next";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import IndicatorDetailContent from "./IndicatorDetailContent";

interface IndicatorPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getIndicator(slug: string) {
  const supabase = createReadOnlyServerClient();

  const { data: indicator, error } = await supabase
    .from("indicators")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !indicator) {
    return null;
  }

  return indicator;
}

export async function generateMetadata({ params }: IndicatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const indicator = await getIndicator(slug);

  if (!indicator) {
    return {
      title: "Indicator Not Found - StatsGH",
    };
  }

  const description = indicator.description || `View ${indicator.name} data and trends for Ghana.`;

  return {
    title: `${indicator.name} - StatsGH`,
    description,
    alternates: {
      canonical: `https://statsgh.com/data/${slug}`,
    },
    openGraph: {
      type: "website",
      title: `${indicator.name} - StatsGH`,
      description,
      url: `https://statsgh.com/data/${slug}`,
      siteName: "StatsGH",
      images: [
        {
          url: "/social/statsgh-og-1200x630.png",
          width: 1200,
          height: 630,
          alt: `${indicator.name} - StatsGH`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${indicator.name} - StatsGH`,
      description,
      images: [
        {
          url: "/social/statsgh-og-1200x630.png",
          alt: `${indicator.name} - StatsGH`,
        },
      ],
    },
  };
}

export default async function IndicatorPage({ params }: IndicatorPageProps) {
  const { slug } = await params;
  return <IndicatorDetailContent slug={slug} />;
}
