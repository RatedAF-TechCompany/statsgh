import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import EntityClient from "./EntityClient";

export const dynamic = "force-dynamic";

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getServerSupabase();
  const { data } = await supabase.from("entities").select("name").eq("slug", slug).maybeSingle();
  if (!data) return { title: "Entity | StatsGH" };
  const title = `${data.name} — StatsGH coverage`;
  const description = `All StatsGH articles mentioning ${data.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `https://statsgh.com/entity/${slug}` },
    openGraph: { title, description, url: `https://statsgh.com/entity/${slug}`, siteName: "StatsGH" },
  };
}

export default async function EntityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getServerSupabase();

  const { data: entity } = await supabase
    .from("entities")
    .select("id, name, entity_type, description")
    .eq("slug", slug)
    .maybeSingle();
  if (!entity) notFound();

  const { data: links } = await supabase
    .from("article_entities")
    .select("article_id")
    .eq("entity_id", entity.id)
    .limit(50);

  const articleIds = (links || []).map((l: any) => l.article_id);
  const articlesRes = articleIds.length
    ? await supabase
        .from("articles")
        .select("id, title, slug, category_slug, summary, published_at")
        .in("id", articleIds)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
    : { data: [] as any[] };

  return <EntityClient entity={entity} articles={articlesRes.data || []} />;
}
