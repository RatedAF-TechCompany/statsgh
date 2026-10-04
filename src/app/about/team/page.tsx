export const dynamic = "force-dynamic";
import Link from "next/link";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";

export const metadata = pageMeta("/about/team", "Our team", "The StatsGH bylines and the Data Desk that compiles our automated data products.");

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
    </PageShell>
  );
}
