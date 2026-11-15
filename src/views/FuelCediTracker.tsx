"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { EmbedShare } from "@/components/EmbedShare";

import { fetchFxPreferBog, fetchBrent, fetchPump, fmtDate, type FxSeries, type Pt } from "@/lib/fuelCedi";
export { fetchFx, fetchFxPreferBog, fetchBrent, fetchPump } from "@/lib/fuelCedi";
const MIN_POINTS = 2;

const ChartCard = ({
  title, unit, points, source, sourceHref, decimals = 2, note, embed,
}: {
  embed?: string; title: string; unit: string; points: Pt[] | undefined; source: string; sourceHref?: string; decimals?: number; note?: string;
}) => {
  const last = points?.[points.length - 1];
  const first = points?.[0];
  return (
    <section className="border-t border-[#D9D9D9] py-6">
      <h2 className="kicker mb-1">{title}</h2>
      {!points ? (
        <p className="text-sm text-[#5B5B5B]">Loading…</p>
      ) : points.length === 0 ? (
        <p className="font-serif text-[17px] text-[#5B5B5B]">Data unavailable — no stored observations yet.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-serif text-3xl font-bold text-[#121212]">{last!.value.toFixed(decimals)}</span>
            <span className="text-sm text-[#5B5B5B]">{unit}</span>
          </div>
          {points.length < MIN_POINTS ? (
            <p className="text-sm text-[#5B5B5B] mb-2">
              Tracking started {fmtDate(first!.date)} — a chart will appear once more observations are stored.
            </p>
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E8E8E8" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => fmtDate(d).replace(/ \d{4}$/, "")} minTickGap={40} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={48} />
                    <Tooltip labelFormatter={(d) => fmtDate(String(d))} formatter={(v: number) => [v.toFixed(decimals), unit]} />
                    <Line type="monotone" dataKey="value" stroke="#E3120B" strokeWidth={2} dot={points.length < 30} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[#5B5B5B] mt-1">Tracking started {fmtDate(first!.date)} · {points.length} observations</p>
            </>
          )}
          <p className="text-xs text-[#5B5B5B] mt-1">
            Source: {sourceHref ? <a className="underline" href={sourceHref} target="_blank" rel="noopener noreferrer">{source}</a> : source}
            {" "}· Last updated {fmtDate(last!.date)}
          </p>
          {note && <p className="text-xs text-[#5B5B5B] mt-1">{note}</p>}
          {embed && <EmbedShare series={embed} title={title} />}
        </>
      )}
    </section>
  );
};

const FuelCediTracker = ({ lead }: { lead?: string } = {}) => {
  const usd = useQuery({ queryKey: ["fct-fx2", "USD"], queryFn: () => fetchFxPreferBog("USD") });
  const eur = useQuery({ queryKey: ["fct-fx2", "EUR"], queryFn: () => fetchFxPreferBog("EUR") });
  const gbp = useQuery({ queryKey: ["fct-fx2", "GBP"], queryFn: () => fetchFxPreferBog("GBP") });
  const fxProps = (q: { data?: FxSeries }) => q.data?.official === false
    ? { points: q.data.points, source: "open.er-api.com (market mid-rate, not official)", sourceHref: "https://open.er-api.com", note: "Official Bank of Ghana figures unavailable; showing an open-market mid-rate." }
    : { points: q.data?.points, source: "Bank of Ghana — daily interbank FX rates", sourceHref: "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/", note: "Official BoG interbank mid-rate. Full table on our Cedi exchange rates page (/markets/forex)." };
  const brent = useQuery({ queryKey: ["fct-brent"], queryFn: fetchBrent });
  const pump = useQuery({ queryKey: ["fct-pump"], queryFn: fetchPump });

  const pumpList = [...(pump.data?.petrol || []).map((p) => ({ ...p, kind: "Petrol" })), ...(pump.data?.diesel || []).map((p) => ({ ...p, kind: "Diesel" }))]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[860px] mx-auto px-4 md:px-6 py-8">
        <div className="border-b border-[#E3120B] pb-3 mb-2">
          <p className="text-xs uppercase tracking-wide text-[#5B5B5B]">
            <Link to="/markets-data" className="hover:underline">Markets &amp; Data</Link> · Trackers
          </p>
          <h1 className="section-label text-base">Fuel &amp; Cedi Weekly</h1>
        </div>
        {lead && <p className="font-serif text-[19px] leading-[1.6] text-[#121212] pt-4" data-indicator-lead>{lead}</p>}
        <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">
          The cedi's exchange rate, world crude prices and Ghana's pump prices, from stored observations only.
          Where history is short we say when tracking started rather than fill gaps.
        </p>

        <ChartCard embed="usd" title="US dollar to cedi (USD/GHS)" unit="GHS per US$" {...fxProps(usd)} />
        <ChartCard embed="eur" title="Euro to cedi (EUR/GHS)" unit="GHS per €" {...fxProps(eur)} />
        <ChartCard embed="gbp" title="Pound to cedi (GBP/GHS)" unit="GHS per £" {...fxProps(gbp)} />
        <ChartCard embed="brent"
          title="Brent crude"
          unit="US$ per barrel"
          points={brent.data}
          source="FRED (EIA) DCOILBRENTEU"
          sourceHref="https://fred.stlouisfed.org/series/DCOILBRENTEU"
          note="Daily EIA spot price; published with a lag of several days."
        />
        <ChartCard embed="petrol" title="Ghana petrol pump price" unit="GHS per litre" points={pump.data?.petrol} source="Figures cited in StatsGH articles" note="Taken from the key numbers of published articles, dated by article publication. Not an official price series." />
        <ChartCard embed="diesel" title="Ghana diesel pump price" unit="GHS per litre" points={pump.data?.diesel} source="Figures cited in StatsGH articles" note="Taken from the key numbers of published articles, dated by article publication. Not an official price series." />

        {pumpList.length > 0 && (
          <section className="border-t border-[#D9D9D9] py-6">
            <h2 className="kicker mb-3">Pump-price figures and their articles</h2>
            <ul className="space-y-2 text-sm">
              {pumpList.map((p) => (
                <li key={`${p.kind}-${p.slug}`} className="flex gap-3">
                  <span className="w-24 shrink-0 text-[#5B5B5B]">{fmtDate(p.date)}</span>
                  <span className="w-28 shrink-0 font-semibold">{p.kind} GHS {p.value.toFixed(2)}</span>
                  <Link to={`/${p.cat}/${p.slug}`} className="underline">{p.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <div className="max-w-3xl mx-auto px-4 pb-8"><a href="/tools/cost-of-living" className="text-sm font-semibold text-[#E3120B] underline">Cost of Living Calculator: what these prices mean for your budget →</a></div>
      <Footer />
    </div>
  );
};

export default FuelCediTracker;
