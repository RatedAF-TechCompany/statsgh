"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

type Reading = {
  kind: "headline" | "food" | "non_food";
  period: string;
  value: number;
  article_slug: string | null;
  category_slug: string | null;
  article_title: string | null;
  source_count: number;
  extracted_at: string;
};

const LABEL: Record<Reading["kind"], string> = { headline: "Headline", food: "Food", non_food: "Non-food" };
const COLOR: Record<Reading["kind"], string> = { headline: "#E3120B", food: "#1F6F50", non_food: "#2E5AAC" };
const BOG_TARGET = 8;

const monthLabel = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const dayLabel = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

async function fetchReadings(): Promise<Reading[]> {
  const { data, error } = await supabase
    .from("inflation_readings")
    .select("kind, period, value, article_slug, category_slug, article_title, source_count, extracted_at")
    .order("period", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, value: Number(r.value) }));
}

const MoneyBox = ({ latest }: { latest?: Reading }) => {
  if (!latest) return null;
  const r = latest.value;
  const per100 = (100 * (1 + r / 100)).toFixed(2);
  return (
    <section className="my-6 border-l-4 border-[#E3120B] bg-[#FAF7F2] p-5">
      <h2 className="kicker mb-2">What it means for your money</h2>
      <div className="font-serif text-[17px] leading-[1.7] text-[#121212] space-y-3">
        <p>
          Headline inflation was <strong>{r.toFixed(1)}%</strong> in {monthLabel(latest.period)}. On average, a basket
          of goods and services that cost <strong>GHS 100</strong> a year earlier cost about <strong>GHS {per100}</strong>.
        </p>
        <p>
          If your income or savings grew by less than {r.toFixed(1)}% over the same year, you can buy less with them
          than before. If they grew by more, your buying power rose.
        </p>
        <p>
          {r < BOG_TARGET - 2
            ? `This is below the Bank of Ghana's medium-term target of ${BOG_TARGET}% ± 2%: prices are rising, but more slowly than the central bank aims for.`
            : r > BOG_TARGET + 2
            ? `This is above the Bank of Ghana's medium-term target of ${BOG_TARGET}% ± 2%: prices are rising faster than the central bank aims for.`
            : `This is within the Bank of Ghana's medium-term target of ${BOG_TARGET}% ± 2%.`}
        </p>
        <p className="text-sm text-[#5B5B5B]">
          Inflation is an average. Your own costs can rise faster or slower depending on what you buy — food and
          non-food prices often move differently.
        </p>
      </div>
    </section>
  );
};

const InflationTracker = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ["inflation-readings"], queryFn: fetchReadings });
  const readings = data || [];
  const headline = readings.filter((r) => r.kind === "headline");
  const latestHeadline = headline[headline.length - 1];
  const latestOf = (k: Reading["kind"]) => [...readings].reverse().find((r) => r.kind === k);
  const periods = [...new Set(readings.map((r) => r.period))].sort();
  const chartData = periods.map((p) => {
    const row: Record<string, any> = { period: p };
    readings.filter((r) => r.period === p).forEach((r) => (row[r.kind] = r.value));
    return row;
  });
  const lastExtracted = readings.reduce<string | null>((m, r) => (!m || r.extracted_at > m ? r.extracted_at : m), null);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[860px] mx-auto px-4 md:px-6 py-8">
        <div className="border-b border-[#E3120B] pb-3 mb-2">
          <p className="text-xs uppercase tracking-wide text-[#5B5B5B]">
            <Link to="/markets-data" className="hover:underline">Markets &amp; Data</Link> · Trackers
          </p>
          <h1 className="section-label text-base">Inflation Explainer</h1>
        </div>
        <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">
          Ghana's monthly consumer price inflation — headline, food and non-food — as published by the Ghana
          Statistical Service and reported in StatsGH articles. Each figure links to the article it came from.
        </p>

        {isLoading ? (
          <p className="text-sm text-[#5B5B5B]">Loading…</p>
        ) : isError || readings.length === 0 ? (
          <p className="font-serif text-[17px] text-[#5B5B5B]">Data unavailable — no inflation readings stored yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 py-4 border-t border-[#D9D9D9]">
              {(["headline", "food", "non_food"] as const).map((k) => {
                const r = latestOf(k);
                return (
                  <div key={k}>
                    <div className="text-xs uppercase tracking-wide text-[#5B5B5B]">{LABEL[k]}</div>
                    <div className="font-serif text-3xl font-bold" style={{ color: COLOR[k] }}>
                      {r ? `${r.value.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-[#5B5B5B]">{r ? `${monthLabel(r.period)}, year-on-year` : "Not reported yet"}</div>
                  </div>
                );
              })}
            </div>

            <MoneyBox latest={latestHeadline} />

            <section className="border-t border-[#D9D9D9] py-6">
              <h2 className="kicker mb-2">Readings over time (% year-on-year)</h2>
              {periods.length < 2 ? (
                <p className="text-sm text-[#5B5B5B]">Tracking started {monthLabel(periods[0])} — a chart will appear once more months are stored.</p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#E8E8E8" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={monthLabel} />
                      <YAxis tick={{ fontSize: 11 }} width={40} unit="%" />
                      <Tooltip labelFormatter={(d) => monthLabel(String(d))} formatter={(v: number, n: string) => [`${v}%`, LABEL[n as Reading["kind"]] || n]} />
                      <Legend formatter={(n) => LABEL[n as Reading["kind"]] || n} />
                      {(["headline", "food", "non_food"] as const).map((k) => (
                        <Line key={k} type="monotone" dataKey={k} stroke={COLOR[k]} strokeWidth={2} connectNulls dot />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-[#5B5B5B] mt-2">
                Tracking started {monthLabel(periods[0])}. Months with no reported figure are left blank, not filled in.
              </p>
              <p className="text-xs text-[#5B5B5B] mt-1">
                Source: Ghana Statistical Service figures as cited in StatsGH articles (linked below)
                {lastExtracted && <> · Last updated {dayLabel(lastExtracted)}</>}
              </p>
            </section>

            <section className="border-t border-[#D9D9D9] py-6">
              <h2 className="kicker mb-3">Every reading and its source</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#5B5B5B] border-b border-[#D9D9D9]">
                    <th className="py-2 pr-3">Month</th><th className="py-2 pr-3">Measure</th><th className="py-2 pr-3">Rate</th><th className="py-2">Source article</th>
                  </tr>
                </thead>
                <tbody>
                  {[...readings].sort((a, b) => b.period.localeCompare(a.period) || a.kind.localeCompare(b.kind)).map((r) => (
                    <tr key={`${r.kind}-${r.period}`} className="border-b border-[#EFEFEF] align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{monthLabel(r.period)}</td>
                      <td className="py-2 pr-3">{LABEL[r.kind]}</td>
                      <td className="py-2 pr-3 font-semibold">{r.value.toFixed(1)}%</td>
                      <td className="py-2">
                        {r.article_slug ? <Link to={`/${r.category_slug}/${r.article_slug}`} className="underline">{r.article_title}</Link> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-[#5B5B5B] mt-3">
                How we build this: once a day we read the key numbers of published StatsGH articles and keep only
                figures clearly labelled as headline, food or non-food inflation for a named month. Forecasts, targets,
                producer prices and old figures are ignored. Where articles disagree, the figure most articles report is used.
              </p>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default InflationTracker;
