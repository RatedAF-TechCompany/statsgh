export const dynamic = "force-dynamic"; // personalised/live page: render per request
import { notFound, permanentRedirect } from "next/navigation";
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

  // Unknown or unpublished slug: a real 404 with noindex (Zeb, 15 Nov 2026: no redirect of missing
  // addresses to /news). Google counted the old 301 to /news as Soft 404 / Page with redirect.
  notFound();
}
