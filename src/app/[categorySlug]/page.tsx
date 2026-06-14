import type { Metadata } from "next";
import { getSectionLabel } from "@/lib/navigation";
import Category from "@/views/Category";

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const label = getSectionLabel(categorySlug) || "News";
  const canonicalUrl = `https://statsgh.com/${categorySlug}`;
  const description = `Latest ${label} news and data from StatsGH — Ghana's data journalism platform.`;

  return {
    title: `${label} | StatsGH`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      title: `${label} | StatsGH`,
      description,
      url: canonicalUrl,
      siteName: "StatsGH",
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${label} | StatsGH`,
      description,
    },
  };
}

export default function CategoryPage() {
  return <Category />;
}
