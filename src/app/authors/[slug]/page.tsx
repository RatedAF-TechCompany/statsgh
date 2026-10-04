export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";
import { fmtDate, monthLabel } from "@/lib/reports";

type P = { params: Promise<{ slug: string }> };
const load = async (slug: string) =>
  (await createReadOnlyServerClient().from("authors").select("*").eq("slug", slug).eq("is_active", true).maybeSingle()).data;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a) return { title: "Author not found | StatsGH", robots: { index: false } };
  return pageMeta(`/authors/${a.slug}`, `${a.display_name}${a.role ? `, ${a.role}` : ""}`, (a.bio || `Stories by ${a.display_name} on StatsGH.`).slice(0, 158));
}

export default async function AuthorPage({ params }: P) {
  const a = await load((await params).slug);
  if (!a) notFound();
  const sb = createReadOnlyServerClient();
  const names = Array.from(new Set([a.display_name, ...(a.byline_aliases || [])]));
  const [{ data: arts }, { data: reps }] = await Promise.all([
    sb.from("articles").select("title, slug, category_slug, published_at, summary").eq("is_published", true).in("author_name", names).order("published_at", { ascending: false }).limit(50),
    a.kind === "desk" ? sb.from("reports").select("kind, edition").order("edition", { ascending: false }).limit(12) : Promise.resolve({ data: [] as { kind: string; edition: string }[] }),
  ]);
  const url = `https://www.statsgh.com/authors/${a.slug}`;
  const ld = a.kind === "desk"
    ? { "@context": "https://schema.org", "@type": "Organization", name: a.display_name, url, description: a.bio, parentOrganization: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" } }
    : { "@context": "https://schema.org", "@type": "Person", name: a.display_name, url, jobTitle: a.role || undefined, description: a.bio || undefined, knowsAbout: a.expertise, worksFor: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" } };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <p className="font-ui text-xs mb-2"><Link href="/about/team" className="text-[#E3120B]">← Our team</Link></p>
      <h1 className="font-headline text-[34px] text-[#121212]">{a.display_name}</h1>
      {a.role && <p className="font-ui text-sm uppercase tracking-wide text-[#E3120B]">{a.role}</p>}
      {a.bio && <p className="font-serif text-[18px] leading-[1.6] text-[#121212] mt-3 max-w-[760px]">{a.bio}</p>}
      {a.expertise?.length > 0 && <p className="font-ui text-sm text-[#5B5B5B] mt-3"><span className="font-semibold">Areas:</span> {a.expertise.join(" · ")}</p>}
      <div className="my-4"><ShareBar url={url} title={`${a.display_name} on StatsGH`} /></div>
      {reps && reps.length > 0 && (
        <section className="mt-6">
          <h2 className="kicker mb-2">Latest reports</h2>
          <ul className="font-ui text-sm space-y-1">{reps.map((r) => <li key={r.kind + r.edition}><Link className="hover:text-[#E3120B]" href={`/reports/${r.kind}/${r.edition}`}>{r.kind === "economy-scorecard" ? `Economy Scorecard, week ending ${fmtDate(r.edition)}` : `State of the Cedi, ${monthLabel(r.edition)}`}</Link></li>)}</ul>
        </section>
      )}
      <section className="mt-6">
        <h2 className="kicker mb-2">Stories</h2>
        {!arts?.length ? <p className="font-ui text-sm text-[#5B5B5B]">No published stories carry this byline yet.</p> : (
          <ul className="divide-y divide-[#EEE]">{arts.map((x) => (
            <li key={x.slug} className="py-3">
              <Link href={`/${x.category_slug}/${x.slug}`} className="font-headline text-[18px] text-[#121212] hover:text-[#E3120B]">{x.title}</Link>
              <p className="font-ui text-xs text-[#5B5B5B] mt-0.5">{fmtDate(x.published_at)}</p>
            </li>))}</ul>
        )}
      </section>
    </PageShell>
  );
}
