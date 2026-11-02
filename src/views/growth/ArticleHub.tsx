"use client";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/markets/MarketBits";
import { ilikeOr } from "@/lib/postgrest-filter";

type A = { id: string; title: string; slug: string; category_slug: string | null; summary: string | null; published_at: string | null };

/** Lists real published StatsGH articles matching tags or title terms, newest first, with their update-box count.
 *  Developing stories are updated inside the article (dated update boxes) — hubs never host live pages. */
export const ArticleHubList = ({ tags, titleTerms, empty }: { tags: string[]; titleTerms: string[]; empty: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["hub", tags.join(","), titleTerms.join(",")],
    queryFn: async () => {
      const ors = [...titleTerms.map((t) => ilikeOr(["title"], t)), tags.length ? `tags.ov.{${tags.join(",")}}` : ""].filter(Boolean).join(",");
      const { data, error } = await supabase.from("articles").select("id,title,slug,category_slug,summary,published_at")
        .eq("is_published", true).or(ors).order("published_at", { ascending: false }).limit(60);
      if (error) throw error;
      const rows = (data || []) as A[];
      const counts: Record<string, number> = {};
      if (rows.length) {
        const { data: ups } = await (supabase as any).from("story_updates").select("article_id").in("article_id", rows.map((r) => r.id));
        for (const u of ups || []) counts[u.article_id] = (counts[u.article_id] || 0) + 1;
      }
      return { rows, counts };
    },
  });
  if (isLoading) return <p className="font-ui text-[#5B5B5B] py-4">Loading…</p>;
  if (!data?.rows.length) return <p className="font-serif text-[17px] text-[#5B5B5B] border-t border-[#D9D9D9] py-4">{empty}</p>;
  return (
    <ul className="divide-y divide-[#D9D9D9] border-t border-[#D9D9D9]">
      {data.rows.map((a) => (
        <li key={a.id} className="py-4">
          <Link to={`/${a.category_slug || "news"}/${a.slug}`} className="font-headline text-[20px] font-bold text-[#121212] hover:text-[#E3120B]">{a.title}</Link>
          {a.summary && <p className="font-serif text-[16px] text-[#5B5B5B] mt-1">{a.summary}</p>}
          <p className="font-ui text-[12px] text-[#5B5B5B] mt-1">
            {a.published_at && new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {data.counts[a.id] ? <span className="ml-2 text-[#E3120B] font-semibold">{data.counts[a.id]} update{data.counts[a.id] > 1 ? "s" : ""}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
};

export const Prose = ({ children }: { children: React.ReactNode }) => (
  <div className="font-serif text-[17px] leading-[1.75] text-[#121212] space-y-4 [&_h2]:kicker [&_h2]:pt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline [&_a]:text-[#E3120B]">{children}</div>
);
export const UpdatesNote = () => (
  <p className="font-ui text-[13px] text-[#5B5B5B] border-l-4 border-[#E3120B] pl-3 my-4">Developing stories are updated inside each article with dated update boxes, so every change stays on the record.</p>
);
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="kicker mb-3">{title}</h2>{children}</section>
);
export { PageShell };
