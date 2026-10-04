"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, ShareRow, Methodology } from "@/components/markets/MarketBits";
import { DEAL_TYPES } from "@/lib/companies";
import { downloadCsv, fmtDay } from "@/lib/bogRates";

type Deal = { id: string; title: string; slug: string; category_slug: string; published_at: string | null; deal_type: string; summary: string | null };

const Deals = () => {
  const [type, setType] = useState("");
  const [sector, setSector] = useState("");
  const q = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("articles").select("id, title, slug, category_slug, published_at, deal_type, summary")
        .eq("is_published", true).eq("is_sponsored", false).not("deal_type", "is", null).order("published_at", { ascending: false }).limit(1000);
      return (data || []) as Deal[];
    },
  });
  const all = q.data || [];
  const sectors = [...new Set(all.map((d) => d.category_slug))].sort();
  const rows = all.filter((d) => (!type || d.deal_type === type) && (!sector || d.category_slug === sector));
  return (
    <PageShell wide title="Deals tracker" intro="Corporate deals, mergers and acquisitions, bond and Eurobond issues, IPOs, capital raises and large contracts reported by StatsGH.">
      <ShareRow text="Ghana deals tracker: M&A, bonds, IPOs and capital raises reported by StatsGH" path="/deals" />
      <div className="flex flex-wrap gap-2 my-3 font-ui text-[13px]">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Deal type" className="border border-[#D9D9D9] h-9 px-2">
          <option value="">All deal types</option>
          {Object.entries(DEAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector" className="border border-[#D9D9D9] h-9 px-2">
          <option value="">All sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
        </select>
        <button className="underline text-[#E3120B]" onClick={() => downloadCsv("statsgh-deals.csv", [["published", "deal_type", "sector", "headline", "url"], ...rows.map((d) => [d.published_at?.slice(0, 10) || "", DEAL_TYPES[d.deal_type] || d.deal_type, d.category_slug, d.title, `https://www.statsgh.com/${d.category_slug}/${d.slug}`])])}>Download CSV</button>
        <span className="text-[#5B5B5B] self-center">{rows.length} stories</span>
      </div>
      {q.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : rows.length === 0 ? <p className="text-sm text-[#5B5B5B]">No deals match these filters.</p> : (
        <ul className="divide-y divide-[#EFEFEF]">
          {rows.map((d) => (
            <li key={d.id} className="py-2">
              <span className="font-ui text-[10px] uppercase tracking-wider font-bold text-[#0F5499] mr-2">{DEAL_TYPES[d.deal_type] || d.deal_type}</span>
              <Link to={`/${d.category_slug}/${d.slug}`} className="font-headline text-[16px] font-bold hover:underline">{d.title}</Link>
              <p className="font-ui text-[11px] text-[#5B5B5B]">{d.published_at ? fmtDay(d.published_at.slice(0, 10)) : ""} · {d.category_slug.replace(/-/g, " ")}</p>
            </li>
          ))}
        </ul>
      )}
      <Methodology>Deals come only from articles StatsGH has already published. Each story is tagged by a keyword classifier on its headline and summary (for example "acquisition", "Eurobond", "rights issue", "contract worth"), or by an editor. Automatic tags can be wrong; follow the link to the story for the facts and its source.</Methodology>
    </PageShell>
  );
};
export default Deals;
