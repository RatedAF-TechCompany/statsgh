"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { KeyNumbersBox, Methodology, PageShell, ShareRow, TimeChart } from "@/components/markets/MarketBits";
import { downloadCsv } from "@/lib/bogRates";
import { byYear, fetchMacro, latestActual, year } from "@/lib/macro";
import type { TopicDashboard as TD } from "@/lib/topicDashboards";

const COLORS = ["#E3120B", "#1F5C99", "#2E8B57", "#B8860B", "#6A3D9A"];
const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

const WdiDashboard = ({ t }: { t: TD }) => {
  const keys = t.series.map((s) => s.key);
  const { data, isLoading, isError } = useQuery({ queryKey: ["macro", "topic", t.slug], queryFn: () => fetchMacro(keys) });
  const d = data || {};
  const items = t.series.map((s) => {
    const p = latestActual(d[s.key]);
    return p && { label: `${s.name} ${year(p.period)}`, value: fmt(p.value), note: s.unit };
  }).filter(Boolean) as { label: string; value: string; note?: string }[];
  const fetched = t.series.map((s) => latestActual(d[s.key])?.fetched_at).filter(Boolean).sort().pop();
  const first = latestActual(d[t.series[0].key]);

  return (
    <PageShell wide kicker={<Link to="/dashboards" className="hover:underline">Dashboards</Link>} title={t.title} intro={t.intro}>
      {isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : isError ? <p className="text-sm text-[#5B5B5B]">Could not load data. Please try again later.</p> :
        <KeyNumbersBox items={items} source="World Bank World Development Indicators" sourceHref="https://data.worldbank.org/country/ghana" asOf={fetched} />}
      {first && <ShareRow text={`${t.title.replace(" Dashboard", "")}: ${t.series[0].name} ${fmt(first.value)} ${t.series[0].unit} in ${year(first.period)} (World Bank)`} path={`/dashboards/${t.slug}`} />}
      {t.series.map((s, i) => {
        const pts = d[s.key] || [];
        const rows = byYear({ [s.key]: pts }, [s.key], 1960);
        const last = latestActual(pts);
        if (!last) return null;
        return (
          <section key={s.key} className="py-4 border-t border-[#D9D9D9]">
            <h2 className="kicker mb-2">{s.name}, {s.unit}</h2>
            {rows.length > 1 ? <TimeChart yearly data={rows} unit={s.unit} dp={1} series={[{ key: s.key, name: s.name, color: COLORS[i % COLORS.length] }]} />
              : <p className="font-serif text-[15px] text-[#5B5B5B]">Only one reading: {fmt(last.value)} {s.unit} ({year(last.period)}).</p>}
            <p className="font-ui text-[11px] text-[#5B5B5B]">Source: <a className="underline" href={last.source_url} target="_blank" rel="noopener noreferrer">{last.source}</a> · {rows.length} annual readings, latest {year(last.period)} · retrieved {last.fetched_at.slice(0, 10)}</p>
          </section>
        );
      })}
      {items.length > 0 && <button className="font-ui text-[12px] underline text-[#E3120B]" onClick={() => downloadCsv(`ghana-${t.slug}.csv`, [["series", "indicator_code", "year", "value", "unit", "source", "source_url"],
        ...t.series.flatMap((s) => (d[s.key] || []).map((p) => [s.name, s.code, year(p.period), p.value, s.unit, p.source, p.source_url]))])}>Download all as CSV</button>}
      <Methodology>
        <p>Every figure is read from the World Bank's public World Development Indicators API for Ghana and stored with its indicator code, source link and retrieval date; nothing is estimated by StatsGH. Codes: {t.series.map((s) => s.code).join(", ")}.</p>
        <p>World Bank series are annual and usually lag by one to two years; "modelled" figures are ILO or UN estimates, not Ghana Statistical Service survey results. For official national releases see <a className="underline" href="https://statsghana.gov.gh" target="_blank" rel="noopener noreferrer">statsghana.gov.gh</a>.</p>
      </Methodology>
    </PageShell>
  );
};
export default WdiDashboard;
