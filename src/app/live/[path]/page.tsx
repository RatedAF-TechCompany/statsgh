import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LivePageClient } from "../LivePageClient";
import { getLiveStore } from "@/lib/live/store";
import { parseLivePath, liveUrl } from "@/lib/live/paths";
import { liveBlogJsonLd } from "@/lib/live/jsonld";

export const revalidate = 60;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

interface Props { params: Promise<{ path: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  if (!parseLivePath(path)) return { title: "Live coverage | StatsGH", robots: { index: false, follow: true } };
  const store = await getLiveStore();
  const page = await store.getByPath(path, { includeHidden: true });
  if (!page) return { title: "Live coverage | StatsGH", robots: { index: false, follow: true } };
  const url = liveUrl(page.path);
  const description = page.summary_bullets.join(" ");
  const noindex = page.visibility === "hidden" || page.status === "draft";
  return {
    title: `${page.headline} | StatsGH`,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "article",
      title: page.headline,
      description,
      url,
      siteName: "StatsGH",
    },
    twitter: { card: "summary_large_image", site: "@StatsGH", title: page.headline, description },
  };
}

export default async function LiveStoryPage({ params }: Props) {
  const { path } = await params;
  if (!parseLivePath(path)) notFound();
  const store = await getLiveStore();
  const page = await store.getByPath(path, { includeHidden: true });
  if (!page) notFound();
  const ld = liveBlogJsonLd(page);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <LivePageClient initial={page} />
    </>
  );
}
