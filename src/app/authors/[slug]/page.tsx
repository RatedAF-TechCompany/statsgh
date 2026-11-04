export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";
import { fmtDate, monthLabel } from "@/lib/reports";

type P = { params: Promise<{ slug: string }> };
// In-house author (Zeb, 4 Nov 2026): every article is credited to Abubakar Saddique.
const IN_HOUSE = { slug: "abubakar-saddique", display_name: "Abubakar Saddique", role: "Data journalist", kind: "person",
  bio: "Abubakar Saddique is StatsGH's in-house data journalist.", expertise: [] as string[], byline_aliases: [] as string[], all: true };
const EDITORS: Record<string, any> = {
  "hawa-kokonu": { slug: "hawa-kokonu", image: "/images/authors/hawa-kokonu.jpg", display_name: "Hawa Kokonu", role: "Chief Editor", kind: "person", bio: "Hawa Kokonu is StatsGH's Chief Editor. She is studying for a BSc in Agribusiness at the University of Energy and Natural Resources (UENR). She has served as Financial Secretary of the UENR Student Representative Council and of the Agripreneur Newsletter, and as Deputy Chief of Staff of the local NUGS.\n\nShe brings strong record-keeping, organisation and communication skills to the newsroom. She makes sure stories are accurate, clear and published on time.", expertise: [], byline_aliases: [], none: true },
  "zebrilla-najib": { slug: "zebrilla-najib", display_name: "Zebrilla Najib", role: "Research Editor", kind: "person", bio: "Zebrilla Najib founded StatsGH, GhanaCrimes and TheCryptoGhana, and edits StatsGH's research articles. He is a registered Reporting Sonographer with over nine years of clinical and research experience in Ghana, Sweden and the UK, including NHS work and an NIH-funded study at the University of Ghana. He holds a BSc in Diagnostic Medical Sonography from KNUST and is studying for an MBE at Karolinska Institutet.\n\nHe brings an evidence-based approach to StatsGH. He checks that figures match their sources, that methods are sound, and that findings are stated plainly.", expertise: [], byline_aliases: [], none: true },
};
const load = async (slug: string): Promise<any> => slug === IN_HOUSE.slug ? IN_HOUSE : EDITORS[slug] ? EDITORS[slug] :
  (await createReadOnlyServerClient().from("authors").select("*").eq("slug", slug).eq("is_active", true).maybeSingle()).data;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a) return { title: "Author not found | StatsGH", robots: { index: false } };
  const m = pageMeta(`/authors/${a.slug}`, `${a.display_name}${a.role ? `, ${a.role}` : ""}`, (a.bio || `Stories by ${a.display_name} on StatsGH.`).slice(0, 158));
  if (a.image) { const img = `https://www.statsgh.com${a.image}`; m.openGraph = { ...m.openGraph, images: [{ url: img, alt: a.display_name }] }; m.twitter = { ...m.twitter, card: "summary", images: [img] }; }
  return m;
}

export default async function AuthorPage({ params }: P) {
  const a = await load((await params).slug);
  if (!a) notFound();
  const sb = createReadOnlyServerClient();
  const names = Array.from(new Set([a.display_name, ...(a.byline_aliases || [])]));
  const [{ data: arts }, { data: reps }] = await Promise.all([
    (a.none ? sb.from("articles").select("title, slug, category_slug, published_at, summary").limit(0) : a.all ? sb.from("articles").select("title, slug, category_slug, published_at, summary").eq("is_published", true) : sb.from("articles").select("title, slug, category_slug, published_at, summary").eq("is_published", true).in("author_name", names)).order("published_at", { ascending: false }).limit(50),
    a.kind === "desk" ? sb.from("reports").select("kind, edition").order("edition", { ascending: false }).limit(12) : Promise.resolve({ data: [] as { kind: string; edition: string }[] }),
  ]);
  const url = `https://www.statsgh.com/authors/${a.slug}`;
  const ld = a.kind === "desk"
    ? { "@context": "https://schema.org", "@type": "Organization", name: a.display_name, url, description: a.bio, parentOrganization: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" } }
    : { "@context": "https://schema.org", "@type": "Person", name: a.display_name, url, jobTitle: a.role || undefined, image: a.image ? `https://www.statsgh.com${a.image}` : undefined, description: a.bio || undefined, knowsAbout: a.expertise, worksFor: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" } };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <p className="font-ui text-xs mb-2"><Link href="/about/team" className="text-[#E3120B]">← Our team</Link></p>
      {a.image && <img src={a.image} alt={`${a.display_name}, ${a.role || "StatsGH"}`} width={160} height={200} className="no-treat w-[140px] h-[175px] sm:w-[160px] sm:h-[200px] object-cover rounded-lg mb-3" />}
      <h1 className="font-headline text-[34px] text-[#121212]">{a.display_name}</h1>
      {a.role && <p className="font-ui text-sm uppercase tracking-wide text-[#E3120B]">{a.role}</p>}
      {a.bio && <p className="font-serif text-[18px] leading-[1.6] text-[#121212] mt-3 max-w-[760px] whitespace-pre-line">{a.bio}</p>}
      {a.expertise?.length > 0 && <p className="font-ui text-sm text-[#5B5B5B] mt-3"><span className="font-semibold">Areas:</span> {a.expertise.join(" · ")}</p>}
      <div className="my-4"><ShareBar url={url} title={`${a.display_name} on StatsGH`} /></div>
      {reps && reps.length > 0 && (
        <section className="mt-6">
          <h2 className="kicker mb-2">Latest reports</h2>
          <ul className="font-ui text-sm space-y-1">{reps.map((r) => <li key={r.kind + r.edition}><Link className="hover:text-[#E3120B]" href={`/reports/${r.kind}/${r.edition}`}>{r.kind === "economy-scorecard" ? `Economy Scorecard, week ending ${fmtDate(r.edition)}` : `State of the Cedi, ${monthLabel(r.edition)}`}</Link></li>)}</ul>
        </section>
      )}
      {!a.none && <section className="mt-6">
        <h2 className="kicker mb-2">Stories</h2>
        {!arts?.length ? <p className="font-ui text-sm text-[#5B5B5B]">No published stories carry this byline yet.</p> : (
          <ul className="divide-y divide-[#EEE]">{arts.map((x) => (
            <li key={x.slug} className="py-3">
              <Link href={`/${x.category_slug}/${x.slug}`} className="font-headline text-[18px] text-[#121212] hover:text-[#E3120B]">{x.title}</Link>
              <p className="font-ui text-xs text-[#5B5B5B] mt-0.5">{fmtDate(x.published_at)}</p>
            </li>))}</ul>
        )}
      </section>}
    </PageShell>
  );
}
