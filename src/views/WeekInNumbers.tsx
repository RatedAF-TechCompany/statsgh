"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { fetchWeeks, type Week as WinWeek } from "@/lib/weekInNumbers";

type Week = WinWeek;

const day = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (v: string) => {
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : v;
};

const WeekInNumbers = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["week-in-numbers"],
    queryFn: fetchWeeks,
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
            {week.items.length === 0 && (
              <p className="font-serif text-[17px] text-[#5B5B5B] py-2">The most-read numbers for this week are compiled on Sunday evening.</p>
            )}
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
                {/* skip the CI line if a stored index value is clearly broken (e.g. 503067 on 2 Nov 2026 vs ~14,000) */}
                {week.gse.ci_start && week.gse.ci_end && week.gse.ci_end / week.gse.ci_start > 0.5 && week.gse.ci_end / week.gse.ci_start < 2 && (
                  <p className="font-mono text-2xl font-bold text-[#121212]">
                    GSE-CI {fmt(String(week.gse.ci_end))}{" "}
                    <span className={week.gse.ci_end >= week.gse.ci_start ? "text-[#2E7D32]" : "text-[#E3120B]"}>
                      {((week.gse.ci_end - week.gse.ci_start) / week.gse.ci_start * 100 >= 0 ? "+" : "")}{((week.gse.ci_end - week.gse.ci_start) / week.gse.ci_start * 100).toFixed(2)}%
                    </span>
                  </p>
                )}
                {/* Only show a movers list that has real entries; an empty list means the share prices for that week
                    were not stored, not that nothing moved, so "None" would mislead. */}
                {(week.gse.gainers?.length > 0 || week.gse.losers?.length > 0) && (
                  <div className="grid md:grid-cols-2 gap-4 mt-2 font-ui text-sm">
                    {([["Top gainers", week.gse.gainers || []], ["Top losers", week.gse.losers || []]] as const).filter(([, list]) => list.length > 0).map(([t, list]) => (
                      <div key={t}><h3 className="font-bold text-xs uppercase text-[#5B5B5B] mb-1">{t}</h3>
                        <ul>{list.map((m) => <li key={m.symbol}><Link to={`/markets/gse/${m.symbol}`} className="underline">{m.symbol}</Link> {m.pct > 0 ? "+" : ""}{m.pct}% <span className="text-[#5B5B5B]">(GH₵{m.c0} → {m.c1})</span></li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}
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
