"use client";
import Link from "next/link";
import { Header } from "@/components/Header";

export default function EntityClient({ entity, articles }: { entity: any; articles: any[] }) {
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
          Related coverage ({articles.length})
        </h2>
        <ul className="space-y-6">
          {articles.map((a: any) => (
            <li key={a.id} className="border-b border-[#EFEFEF] pb-5">
              <Link href={`/${a.category_slug}/${a.slug}`} className="block">
                <h3 className="font-headline text-xl font-semibold text-[#121212] hover:text-[#E3120B]">{a.title}</h3>
                {a.summary && <p className="font-ui text-sm text-[#5B5B5B] mt-1 line-clamp-2">{a.summary}</p>}
                <time className="font-ui text-xs text-[#8A8A8A] mt-2 block">
                  {a.published_at
                    ? new Date(a.published_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                </time>
              </Link>
            </li>
          ))}
          {articles.length === 0 && (
            <li className="font-ui text-sm text-[#5B5B5B]">No published articles yet.</li>
          )}
        </ul>
      </main>
    </>
  );
}
