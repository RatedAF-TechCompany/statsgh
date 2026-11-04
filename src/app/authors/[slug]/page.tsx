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
  "hawa-kokonu": { slug: "hawa-kokonu", display_name: "Hawa Kokonu", role: "Chief Editor", kind: "person", bio: "Hawa Kokonu is StatsGH's Chief Editor. She is studying for a BSc in Agribusiness at the University of Energy and Natural Resources (UENR), with coursework in managerial economics, marketing and information literacy, and was named Best Female Student in Agribusiness at Level 100. She has held finance and leadership roles in Ghanaian student life, including Financial Secretary of the UENR Student Representative Council, Deputy Chief of Staff of the local NUGS, Financial Secretary of the Agripreneur Newsletter, and Public Relations Officer of the Agribusiness Students Association of Ghana at UENR.\n\nShe brings that grounding in record-keeping, accountability and clear communication to the StatsGH newsroom, where she oversees the editorial flow and makes sure stories are accurate, well organised and published on time. Her agribusiness and economics training gives her a practical eye for the farming, trade and household figures that shape life in Ghana.", expertise: [], byline_aliases: [], none: true },
  "zebrilla-najib": { slug: "zebrilla-najib", display_name: "Zebrilla Najib", role: "Research Editor", kind: "person", bio: "Zebrilla Najib is the founder of StatsGH, GhanaCrimes and TheCryptoGhana, and edits StatsGH's research articles. He is an RCT-registered Reporting Sonographer with more than nine years of clinical and research experience across Ghana, Sweden and the United Kingdom, including NHS practice and research work at the University of Ghana on an NIH-funded cohort study of malaria in pregnancy. He holds a BSc in Diagnostic Medical Sonography from KNUST and is studying for an MBE at Karolinska Institutet.\n\nHe brings that evidence-based discipline to every StatsGH research piece: checking that each figure matches its evidence, that methods are sound, and that findings are reported plainly, without overstating what the data shows. His years of training others, peer audit and quality assurance shape how he holds the newsroom's work to a clear, verifiable standard.", expertise: [], byline_aliases: [], none: true },
};
const load = async (slug: string): Promise<any> => slug === IN_HOUSE.slug ? IN_HOUSE : EDITORS[slug] ? EDITORS[slug] :
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
    (a.none ? sb.from("articles").select("title, slug, category_slug, published_at, summary").limit(0) : a.all ? sb.from("articles").select("title, slug, category_slug, published_at, summary").eq("is_published", true) : sb.from("articles").select("title, slug, category_slug, published_at, summary").eq("is_published", true).in("author_name", names)).order("published_at", { ascending: false }).limit(50),
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
