import { redirect } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

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
    redirect(`/${article.category_slug}/${article.slug}`);
  }

  // Unknown slug → top stories (matches old fallback behaviour)
  redirect("/top-stories");
}
