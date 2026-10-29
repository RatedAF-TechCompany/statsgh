export const dynamic = "force-dynamic";
import Link from "next/link";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";

export const metadata = pageMeta("/about/team", "Our team, ownership and masthead", "The StatsGH masthead and ownership, the bylines on our stories and the Data Desk that compiles our automated data products.");

export default async function TeamPage() {
  const { data } = await createReadOnlyServerClient().from("authors").select("slug, display_name, role, bio, expertise, kind").eq("is_active", true).order("sort_order").order("display_name");
  return (
    <PageShell>
      <div className="border-b border-[#E3120B] pb-3 mb-4"><h1 className="section-label text-base">Our team</h1></div>
      <p className="font-serif text-[18px] text-[#5B5B5B] max-w-[760px]">The bylines that appear on StatsGH stories, and the Data Desk that compiles our automated products. See how we work in <Link href="/about#methodology" className="text-[#E3120B] underline">Data sources and methodology</Link>.</p>
      <div className="my-4"><ShareBar url="https://www.statsgh.com/about/team" title="The StatsGH team" /></div>
      {!data?.length ? <p className="font-ui text-sm">No profiles published yet.</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map((a) => (
            <Link key={a.slug} href={`/authors/${a.slug}`} className="block border-t-4 border-[#121212] pt-3 hover:border-[#E3120B]">
              <h2 className="font-headline text-[20px] text-[#121212]">{a.display_name}</h2>
              {a.role && <p className="font-ui text-xs uppercase tracking-wide text-[#E3120B] mt-0.5">{a.role}</p>}
              {a.bio && <p className="font-serif text-[15px] text-[#5B5B5B] mt-2 line-clamp-3">{a.bio}</p>}
              {a.expertise?.length > 0 && <p className="font-ui text-xs text-[#5B5B5B] mt-2">{a.expertise.join(" · ")}</p>}
            </Link>
          ))}
        </div>
      )}
      <section id="ownership" className="mt-10 border-t border-[#121212] pt-4 max-w-[760px]">
        <h2 className="section-label text-base mb-2">Ownership and masthead</h2>
        <p className="font-serif text-[17px] text-[#121212]">StatsGH is an independent Ghana data journalism publication, run by Zebrilla Najib, who is responsible for its editorial direction. Stories are published under the StatsGH Newsroom byline and follow our <Link href="/editorial-standards" className="text-[#E3120B] underline">editorial standards</Link> and <Link href="/corrections" className="text-[#E3120B] underline">corrections policy</Link>. To reach the newsroom, see our <Link href="/contact" className="text-[#E3120B] underline">contact page</Link>.</p>
      </section>
    </PageShell>
  );
}
