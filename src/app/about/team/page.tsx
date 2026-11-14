export const dynamic = "force-dynamic";
import Link from "next/link";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";
import { DESK_BYLINES } from "@/lib/authorSlugs";

export const metadata = pageMeta("/about/team", "Our team, ownership and masthead", "The StatsGH masthead and ownership, our editors and the byline on our stories.");

const TEAM = [
  { name: "Hawa Kokonu", role: "Chief Editor", href: "/authors/hawa-kokonu" },
  { name: "Zebrilla Najib", role: "Research Editor", href: "/authors/zebrilla-najib" },
  ...DESK_BYLINES.map((b) => ({ name: b.name, role: `${b.role} desk`, href: `/authors/${b.slug}` })),
  { name: "Abubakar Saddique", role: "Data journalist", href: "/authors/abubakar-saddique" },
];

export default async function TeamPage() {
  return (
    <PageShell>
      <div className="border-b border-[#E3120B] pb-3 mb-4"><h1 className="section-label text-base">Our team</h1></div>
      <p className="font-serif text-[18px] text-[#5B5B5B] max-w-[760px]">The people behind StatsGH stories. See how we work in <Link href="/about#methodology" className="text-[#E3120B] underline">Data sources and methodology</Link>.</p>
      <div className="my-4"><ShareBar url="https://www.statsgh.com/about/team" title="The StatsGH team" /></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {TEAM.map((a) => (
          <div key={a.name} className="block border-t-4 border-[#121212] pt-3">
            <h2 className="font-headline text-[20px] text-[#121212]">{a.href ? <Link href={a.href} className="hover:text-[#E3120B]">{a.name}</Link> : a.name}</h2>
            <p className="font-ui text-xs uppercase tracking-wide text-[#E3120B] mt-0.5">{a.role}</p>
          </div>
        ))}
      </div>
      <section id="ownership" className="mt-10 border-t border-[#121212] pt-4 max-w-[760px]">
        <h2 className="section-label text-base mb-2">Ownership and masthead</h2>
        <p className="font-serif text-[17px] text-[#121212]">StatsGH is an independent Ghana data journalism publication, run by Zebrilla Najib, who is responsible for its editorial direction. Hawa Kokonu is Chief Editor and Zebrilla Najib is Research Editor, editing all research and data articles. Stories carry the byline of the desk journalist who wrote them; research articles carry Zebrilla Najib's byline, and other stories are credited to Abubakar Saddique, StatsGH's in-house data journalist. All follow our <Link href="/editorial-standards" className="text-[#E3120B] underline">editorial standards</Link> and <Link href="/corrections" className="text-[#E3120B] underline">corrections policy</Link>. To reach the newsroom, see our <Link href="/contact" className="text-[#E3120B] underline">contact page</Link>.</p>
      </section>
    </PageShell>
  );
}
