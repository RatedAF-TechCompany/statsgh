export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getIndicator } from "@/lib/indicators";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import IndicatorDetail from "@/views/IndicatorDetail";

interface IndicatorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: IndicatorPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (getIndicator(slug)) return {};
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

  const canonicalUrl = `https://www.statsgh.com/data/${indicator.slug}`;
  const description = (
    indicator.description ||
    `Live data and historical trends for ${indicator.name} in Ghana, from StatsGH.`
  ).slice(0, 158);

  return {
    title: `${indicator.name} — Ghana Data | StatsGH`.slice(0, 60),
    description,
    alternates: { canonical: canonicalUrl , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
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

// Legacy /data/<slug> (Search Console soft 404, 18 Nov 2026): a slug that has an /indicators page
// 301s there (Next emits 308; worker-entry serves 301); a slug with no indicator row is a real 404,
// not a 200 "Indicator not found" shell. Indicators that only exist here (e.g. fertility-rate) still render.
export default async function IndicatorPage({ params }: IndicatorPageProps) {
  const { slug } = await params;
  if (getIndicator(slug)) permanentRedirect(`/indicators/${slug}`);
  const { data, error } = await createReadOnlyServerClient().from("indicators").select("slug").eq("slug", slug).maybeSingle();
  if (error) throw error; // database trouble is a 500, never a cached 404
  if (!data) notFound();
  return <IndicatorDetail />;
}
