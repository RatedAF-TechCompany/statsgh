"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  article_id: string; slug: string; category_slug: string; title: string; published_at: string;
  label: string; value: string; unit: string | null; context: string | null; views: number;
};
type Mover = { symbol: string; name: string | null; c0: number; c1: number; pct: number };
type GseWeek = { from: string; to: string; trading_days: number; ci_start: number | null; ci_end: number | null; gainers: Mover[]; losers: Mover[]; source: string; source_url: string };
type Week = { week_start: string; week_end: string; items: Item[]; compiled_at: string; gse: GseWeek | null };

const day = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (v: string) => {
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : v;
};

const WeekInNumbers = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["week-in-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("week_in_numbers")
        .select("week_start, week_end, items, compiled_at, gse")
        .order("week_start", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as unknown as Week[];
    },
  });
  const [idx, setIdx] = useState(0);
  const weeks = (data || []).filter((w) => (Array.isArray(w.items) && w.items.length > 0) || !!w.gse);
  const week = weeks[idx];
  const first = weeks[weeks.length - 1];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[860px] mx-auto px-4 md:px-6 py-8">
        <div className="border-b border-[#E3120B] pb-3 mb-2">
          <h1 className="section-label text-base">Week in numbers</h1>
        </div>
        <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">
          The week's most-read StatsGH stories, each reduced to its headline number. Compiled automatically every
          Sunday from published articles; every figure links to its story.
        </p>

        {isLoading ? (
          <p className="text-sm text-[#5B5B5B]">Loading…</p>
        ) : !week ? (
          <p className="font-serif text-[17px] text-[#5B5B5B]">No weekly round-up has been compiled yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between border-t border-[#D9D9D9] py-3">
              <button disabled={idx >= weeks.length - 1} onClick={() => setIdx(idx + 1)} className="font-ui text-xs text-[#E3120B] disabled:text-[#BDBDBD]">← Earlier week</button>
              <h2 className="kicker">{day(week.week_start)} – {day(week.week_end)}</h2>
              <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="font-ui text-xs text-[#E3120B] disabled:text-[#BDBDBD]">Later week →</button>
            </div>
            <ol className="divide-y divide-[#EFEFEF]">
              {week.items.map((it, i) => (
                <li key={it.article_id} className="py-4 grid grid-cols-[28px_1fr] gap-3">
                  <span className="font-ui text-sm text-[#5B5B5B]">{i + 1}</span>
                  <div>
                    <div className="font-mono text-2xl font-bold text-[#121212]">
                      {fmt(it.value)}{it.unit ? ` ${it.unit}` : ""}
                    </div>
                    <div className="font-ui text-sm text-[#5B5B5B]">{it.label}{it.context ? ` — ${it.context}` : ""}</div>
                    <Link to={`/${it.category_slug}/${it.slug}`} className="font-serif text-[16px] text-[#121212] hover:text-[#E3120B] underline">
                      {it.title}
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
            {week.gse && (
              <section className="border-t border-[#D9D9D9] mt-4 pt-3">
                <h2 className="kicker mb-2">GSE week</h2>
                {week.gse.ci_start && week.gse.ci_end && (
                  <p className="font-mono text-2xl font-bold text-[#121212]">
                    GSE-CI {fmt(String(week.gse.ci_end))}{" "}
                    <span className={week.gse.ci_end >= week.gse.ci_start ? "text-[#2E7D32]" : "text-[#E3120B]"}>
                      {((week.gse.ci_end - week.gse.ci_start) / week.gse.ci_start * 100 >= 0 ? "+" : "")}{((week.gse.ci_end - week.gse.ci_start) / week.gse.ci_start * 100).toFixed(2)}%
                    </span>
                  </p>
                )}
                <div className="grid md:grid-cols-2 gap-4 mt-2 font-ui text-sm">
                  {([["Top gainers", week.gse.gainers], ["Top losers", week.gse.losers]] as const).map(([t, list]) => (
                    <div key={t}><h3 className="font-bold text-xs uppercase text-[#5B5B5B] mb-1">{t}</h3>
                      {list.length ? <ul>{list.map((m) => <li key={m.symbol}><Link to={`/markets/gse/${m.symbol}`} className="underline">{m.symbol}</Link> {m.pct > 0 ? "+" : ""}{m.pct}% <span className="text-[#5B5B5B]">(GH₵{m.c0} → {m.c1})</span></li>)}</ul> : <p className="text-[#5B5B5B]">None</p>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#5B5B5B] mt-2">Close {day(week.gse.from)} to close {day(week.gse.to)} ({week.gse.trading_days} trading days) · Source: <a className="underline" href={week.gse.source_url} target="_blank" rel="noopener noreferrer">{week.gse.source}</a></p>
              </section>
            )}
            <p className="text-xs text-[#5B5B5B] mt-3">
              Source: key numbers in StatsGH articles, ranked by readership that week · Compiled {day(week.compiled_at)}
              {first && <> · Tracking started week of {day(first.week_start)}</>}
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default WeekInNumbers;
