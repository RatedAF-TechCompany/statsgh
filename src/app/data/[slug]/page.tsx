import type { Metadata } from "next";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import IndicatorDetail from "@/views/IndicatorDetail";

interface IndicatorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: IndicatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createReadOnlyServerClient();

  const { data: indicator } = await supabase
    .from("indicators")
    .select("name, description, unit, slug, topic:data_topics(name)")
    .eq("slug", slug)
    .maybeSingle();

  if (!indicator) {
    return {
      title: "Indicator not found | StatsGH",
      robots: { index: false, follow: true },
    };
  }

  const canonicalUrl = `https://statsgh.com/data/${indicator.slug}`;
  const description = (
    indicator.description ||
    `Live data and historical trends for ${indicator.name} in Ghana, from StatsGH.`
  ).slice(0, 158);

  return {
    title: `${indicator.name} — Ghana Data | StatsGH`.slice(0, 60),
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      title: `${indicator.name} — Ghana Data | StatsGH`,
      description,
      url: canonicalUrl,
      siteName: "StatsGH",
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${indicator.name} — Ghana Data | StatsGH`,
      description,
    },
  };
}

export default function IndicatorPage() {
  return <IndicatorDetail />;
}
