"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { crimeJusticeOrFilter } from "@/lib/sectionMapping";

type Stat = {
  id: string;
  article_slug: string;
  category_slug: string;
  article_title: string;
  published_at: string;
  metric: "arrests" | "convictions" | "cases" | "amount" | "people";
  label: string;
  context: string | null;
  value: number;
  unit: string | null;
  currency: string | null;
  region: string | null;
  region_source: "explicit" | "inferred" | null;
  confidence: "high" | "medium" | "low";
  confidence_reason: string | null;
  extracted_at: string;
};

const METRIC_LABEL: Record<Stat["metric"], string> = {
  arrests: "Arrests & suspects",
  convictions: "Convictions",
  cases: "Cases & charges",
  amount: "Sums involved",
  people: "People involved",
};

const dayLabel = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthLabel = (m: string) =>
  new Date(`${m}-01`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

const fmtValue = (s: Stat) => {
  if (s.metric !== "amount") return s.value.toLocaleString("en-GB");
  const sym = s.currency === "USD" ? "US$" : s.currency === "EUR" ? "€" : s.currency === "GBP" ? "£" : "GHS ";
  const v = s.value;
  const n = v >= 1e9 ? `${+(v / 1e9).toFixed(2)}bn` : v >= 1e6 ? `${+(v / 1e6).toFixed(2)}m` : v.toLocaleString("en-GB");
  return `${sym}${n}`;
};

async function fetchStats(): Promise<Stat[]> {
  const { data, error } = await supabase
    .from("crime_stats")
    .select("*")
    .eq("is_hidden", false)
    .order("published_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, value: Number(r.value) }));
}

async function fetchMonthly(): Promise<{ month: string; stories: number }[]> {
  const { data } = await supabase
    .from("articles")
    .select("published_at")
    .eq("is_published", true)
    .or(crimeJusticeOrFilter())
    .not("published_at", "is", null)
    .order("published_at", { ascending: true })
    .limit(1000);
  const m = new Map<string, number>();
  (data || []).forEach((a: any) => {
    const k = String(a.published_at).slice(0, 7);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([month, stories]) => ({ month, stories }));
}

const CrimeJusticeTracker = () => {
  const stats = useQuery({ queryKey: ["crime-stats"], queryFn: fetchStats });
  const monthly = useQuery({ queryKey: ["crime-monthly"], queryFn: fetchMonthly });
  const [showAll, setShowAll] = useState(false);
  const allRows = stats.data || [];
  const highCount = allRows.filter((r) => r.confidence === "high").length;
  const rows = showAll ? allRows : allRows.filter((r) => r.confidence === "high");

  const earliest = rows.length ? rows[rows.length - 1].published_at : null;
  const lastExtracted = rows.reduce<string | null>((m, r) => (!m || r.extracted_at > m ? r.extracted_at : m), null);

  const byMetric = (Object.keys(METRIC_LABEL) as Stat["metric"][]).map((k) => ({
    key: k,
    figures: rows.filter((r) => r.metric === k).length,
    articles: new Set(rows.filter((r) => r.metric === k).map((r) => r.article_slug)).size,
  }));

  const regionMap = new Map<string, { articles: Set<string>; figures: number; latest: string }>();
  rows.forEach((r) => {
    const key = r.region ? (r.region_source === "inferred" ? `${r.region} (inferred)` : r.region) : "Unspecified";
    const e = regionMap.get(key) || { articles: new Set<string>(), figures: 0, latest: r.published_at };
    e.articles.add(r.article_slug);
    e.figures += 1;
    if (r.published_at > e.latest) e.latest = r.published_at;
    regionMap.set(key, e);
  });
  const regions = [...regionMap.entries()].sort((a, b) => (a[0] === "Unspecified" ? 1 : b[0] === "Unspecified" ? -1 : b[1].articles.size - a[1].articles.size));

  const monthlyRows = monthly.data || [];
  const figuresByMonth = new Map<string, number>();
  rows.forEach((r) => {
    const k = r.published_at.slice(0, 7);
    figuresByMonth.set(k, (figuresByMonth.get(k) || 0) + 1);
  });

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[900px] mx-auto px-4 md:px-6 py-8">
        <div className="border-b border-[#E3120B] pb-3 mb-2">
          <p className="text-xs uppercase tracking-wide text-[#5B5B5B]">
            <Link to="/crime-justice" className="hover:underline">Crime &amp; Justice</Link> · Trackers
          </p>
          <h1 className="section-label text-base">Crime &amp; Justice Statistics</h1>
        </div>
        <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">
          Arrests, convictions, cases and sums of money reported in StatsGH's Ghana crime and justice stories. Every
          figure links to the article it came from. These are figures cited in reporting, not official national
          crime statistics.
        </p>

        {stats.isLoading ? (
          <p className="text-sm text-[#5B5B5B]">Loading…</p>
        ) : stats.isError || rows.length === 0 ? (
          <p className="font-serif text-[17px] text-[#5B5B5B]">Data unavailable — no figures have been extracted yet.</p>
        ) : (
          <>
            <p className="text-xs text-[#5B5B5B] mb-2">
              Tracking started {dayLabel(earliest!)} · {rows.length} figures from{" "}
              {new Set(rows.map((r) => r.article_slug)).size} articles
              {lastExtracted && <> · Last updated {dayLabel(lastExtracted)}</>}
            </p>
            <div className="flex flex-wrap items-center gap-3 py-2 border-t border-[#D9D9D9]">
              <span className="font-ui text-xs text-[#5B5B5B]">
                {showAll
                  ? `Showing all ${allRows.length} figures (high, medium and low confidence).`
                  : `Showing ${highCount} high-confidence figures. ${allRows.length - highCount} lower-confidence figures are hidden.`}
              </span>
              <button onClick={() => setShowAll(!showAll)} className="font-ui text-xs font-semibold text-[#E3120B] hover:underline">
                {showAll ? "Show high confidence only" : "Show all"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-4 border-t border-[#D9D9D9]">
              {byMetric.map((m) => (
                <div key={m.key}>
                  <div className="text-xs uppercase tracking-wide text-[#5B5B5B]">{METRIC_LABEL[m.key]}</div>
                  <div className="font-serif text-3xl font-bold text-[#121212]">{m.figures}</div>
                  <div className="text-xs text-[#5B5B5B]">figures in {m.articles} articles</div>
                </div>
              ))}
            </div>

            <section className="border-t border-[#D9D9D9] py-6">
              <h2 className="kicker mb-3">Recent figures</h2>
              <ul className="divide-y divide-[#EFEFEF]">
                {rows.slice(0, 25).map((r) => (
                  <li key={r.id} className="py-2 grid grid-cols-[110px_120px_1fr] gap-3 text-sm items-start">
                    <span className="text-[#5B5B5B]">{dayLabel(r.published_at)}</span>
                    <span className="font-semibold">{fmtValue(r)}</span>
                    <span>
                      {r.label}
                      {r.context && <span className="text-[#5B5B5B]"> — {r.context}</span>}
                      <span className="text-[#5B5B5B]"> · {r.region ? `${r.region}${r.region_source === "inferred" ? " (inferred)" : ""}` : "Region unspecified"}</span>
                      {showAll && r.confidence !== "high" && (
                        <span title={r.confidence_reason || undefined} className="ml-2 font-ui text-[10px] uppercase tracking-wide border border-[#BDBDBD] text-[#5B5B5B] px-1 rounded-sm">
                          {r.confidence} confidence
                        </span>
                      )}
                      <br />
                      <Link to={`/${r.category_slug}/${r.article_slug}`} className="text-xs underline text-[#5B5B5B]">
                        Source: {r.article_title}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-t border-[#D9D9D9] py-6">
              <h2 className="kicker mb-3">By region</h2>
              {regions.length === 0 ? (
                <p className="text-sm text-[#5B5B5B]">No region could be identified in the stories tracked so far.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[#5B5B5B] border-b border-[#D9D9D9]">
                      <th className="py-2 pr-3">Region</th><th className="py-2 pr-3">Articles</th><th className="py-2 pr-3">Figures</th><th className="py-2">Latest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map(([name, e]) => (
                      <tr key={name} className="border-b border-[#EFEFEF]">
                        <td className="py-2 pr-3">{name}</td>
                        <td className="py-2 pr-3">{e.articles.size}</td>
                        <td className="py-2 pr-3">{e.figures}</td>
                        <td className="py-2">{dayLabel(e.latest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-[#5B5B5B] mt-2">
                &ldquo;Inferred&rdquo; means the article names only a town or city (e.g. Kumasi) and we mapped it to its region; a
                region without that label is named in the article itself. &ldquo;Unspecified&rdquo; means no region could be
                identified — we don&rsquo;t guess.
              </p>
            </section>

            <section className="border-t border-[#D9D9D9] py-6">
              <h2 className="kicker mb-2">Articles reporting on crime &amp; justice, per month</h2>
              {monthlyRows.length < 2 ? (
                <p className="text-sm text-[#5B5B5B]">
                  {monthlyRows[0] ? `Tracking started ${monthLabel(monthlyRows[0].month)} — a chart will appear once more months are recorded.` : "No stories recorded yet."}
                </p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#E8E8E8" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={monthLabel} />
                      <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
                      <Tooltip labelFormatter={(m) => monthLabel(String(m))} formatter={(v: number, _n, p: any) => [`${v} articles reporting · ${figuresByMonth.get(p.payload.month) || 0} figures extracted`, ""]} />
                      <Bar dataKey="stories" fill="#E3120B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {monthlyRows[0] && (
                <p className="text-xs text-[#5B5B5B] mt-2">
                  Tracking started {monthLabel(monthlyRows[0].month)}. These are counts of published StatsGH articles
                  reporting on crime and justice — not counts of crimes or incidents. One incident can appear in several
                  articles, and most incidents are never reported. Source: <Link to="/crime-justice" className="underline">Crime &amp; Justice section</Link>.
                </p>
              )}
            </section>

            <section className="border-t border-[#D9D9D9] py-6">
              <h2 className="kicker mb-2">How this tracker works and its limits</h2>
              <ul className="list-disc pl-5 space-y-1 font-serif text-[15px] leading-relaxed text-[#121212]">
                <li>Once a day we read the key numbers of published Crime &amp; Justice articles and keep counts of arrests, convictions, cases and people, and sums of money. Ages, dates, durations and percentages are left out.</li>
                <li>Each figure gets a confidence level. <strong>High</strong>: its label or context names a crime or justice fact (an arrest, charge, theft, bribe, conviction, sum recovered). <strong>Medium</strong>: no explicit crime wording, or mixed with budget/price wording. <strong>Low</strong>: looks like a budget line, price or general statistic, or the article has no clear Ghana reference. Only high-confidence figures are shown by default.</li>
                <li>Figures that no longer meet the rules are hidden, never deleted, so the record stays auditable.</li>
                <li>These are figures cited in news reporting, not official crime statistics. They are not added up, sums are shown in the currency reported, and coverage depends on what was reported.</li>
              </ul>
              <p className="text-xs text-[#5B5B5B] mt-3">
                More on how StatsGH sources and verifies numbers: <Link to="/about" className="underline text-[#E3120B]">About &amp; Methodology</Link>.
              </p>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CrimeJusticeTracker;
