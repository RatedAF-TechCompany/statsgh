export const revalidate = 600;
import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/vault/VaultBits";

export const metadata: Metadata = pageMeta(
  "/authors",
  "Authors and desks",
  "The StatsGH journalists, editors and desks behind our data-driven reporting on Ghana's economy, markets and public finance."
);

export default async function AuthorsIndex() {
  const { data } = await createReadOnlyServerClient()
    .from("authors")
    .select("slug, display_name, role, bio, kind")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  const authors = data ?? [];
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "StatsGH authors and desks",
    url: "https://www.statsgh.com/authors",
    hasPart: authors.map((a) => ({
      "@type": a.kind === "desk" ? "Organization" : "Person",
      name: a.display_name,
      url: `https://www.statsgh.com/authors/${a.slug}`,
    })),
  };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="font-headline text-[34px] text-[#121212]">Authors and desks</h1>
      <p className="font-serif text-[18px] leading-[1.6] text-[#121212] mt-3 max-w-[760px]">
        StatsGH reporting is produced by the people and desks below. Read about how we work in our{" "}
        <Link href="/editorial-standards" className="text-[#E3120B] underline">editorial standards</Link>.
      </p>
      <ul className="mt-6 divide-y divide-[#E5E5E5]">
        {authors.map((a) => (
          <li key={a.slug} className="py-4">
            <Link href={`/authors/${a.slug}`} className="font-headline text-xl text-[#121212] hover:text-[#E3120B]">{a.display_name}</Link>
            {a.role && <p className="font-ui text-xs uppercase tracking-wide text-[#E3120B] mt-1">{a.role}</p>}
            {a.bio && <p className="font-serif text-[16px] text-[#3A3A3A] mt-1 max-w-[760px]">{a.bio.length > 220 ? `${a.bio.slice(0, 217)}...` : a.bio}</p>}
          </li>
        ))}
      </ul>
      {authors.length === 0 && <p className="font-ui text-sm text-[#5B5B5B] mt-6">See <Link href="/about/team" className="underline">our team</Link>.</p>}
    </PageShell>
  );
}
