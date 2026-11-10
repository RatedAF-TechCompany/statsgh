export const dynamic = "force-dynamic"; // personalised/live page: render per request
import { permanentRedirect } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { resolveArticleSlug } from "@/lib/articleSlugResolve";

// Legacy /article/:slug links: resolve the article and forward to its
// canonical /:categorySlug/:articleSlug URL instead of dropping to a listing.
export default async function LegacyArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createReadOnlyServerClient();

  const { data: article } = await supabase
    .from("articles")
    .select("slug, category_slug")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (article?.category_slug) {
    permanentRedirect(`/${article.category_slug}/${article.slug}`);
  }
  const match = await resolveArticleSlug(slug);
  if (match) permanentRedirect(`/${match.category_slug}/${match.slug}`);

  // Unknown or unpublished slug: the latest-news index, never a different story.
  permanentRedirect("/news");
}
