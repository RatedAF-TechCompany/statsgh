import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";

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
  const { data } = await supabase.from("entities").select("name, entity_type").eq("slug", slug).maybeSingle();
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
  const { data: articles } = articleIds.length
    ? await supabase
        .from("articles")
        .select("id, title, slug, category_slug, summary, published_at, hero_image_url")
        .in("id", articleIds)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
    : { data: [] as any[] };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 border-b border-[#D9D9D9] pb-6">
          <p className="font-ui text-xs uppercase tracking-[0.14em] text-[#5B5B5B]">{entity.entity_type}</p>
          <h1 className="font-headline text-4xl font-bold text-[#121212] mt-1">{entity.name}</h1>
          {entity.description && <p className="font-ui text-[#5B5B5B] mt-3">{entity.description}</p>}
        </div>
        <h2 className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B] mb-4">
          Related coverage ({articles?.length || 0})
        </h2>
        <ul className="space-y-6">
          {(articles || []).map((a: any) => (
            <li key={a.id} className="border-b border-[#EFEFEF] pb-5">
              <Link href={`/${a.category_slug}/${a.slug}`} className="block">
                <h3 className="font-headline text-xl font-semibold text-[#121212] hover:text-[#E3120B]">{a.title}</h3>
                {a.summary && <p className="font-ui text-sm text-[#5B5B5B] mt-1 line-clamp-2">{a.summary}</p>}
                <time className="font-ui text-xs text-[#8A8A8A] mt-2 block">
                  {a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
                </time>
              </Link>
            </li>
          ))}
          {(!articles || articles.length === 0) && (
            <li className="font-ui text-sm text-[#5B5B5B]">No published articles yet.</li>
          )}
        </ul>
      </main>
    </>
  );
}
