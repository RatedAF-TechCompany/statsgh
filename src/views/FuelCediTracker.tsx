"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { EmbedShare } from "@/components/EmbedShare";

type Pt = { date: string; value: number };
const MIN_POINTS = 2;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Keep the last observation per UTC day. */
const daily = (rows: { t: string; v: number }[]): Pt[] => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.t.slice(0, 10), r.v));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
};

export async function fetchFx(base: string): Promise<Pt[]> {
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data } = await supabase
    .from("currency_rates")
    .select("rate, fetched_at")
    .eq("base_currency", base)
    .eq("target_currency", "GHS")
    .eq("source", "open.er-api.com")
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: true })
    .limit(1000);
  return daily((data || []).map((r) => ({ t: r.fetched_at as string, v: Number(r.rate) })));
}

export async function fetchBrent(): Promise<Pt[]> {
  const { data } = await supabase
    .from("commodity_prices")
    .select("price, fetched_at, source")
    .eq("commodity", "oil_brent")
    .like("source", "FRED%")
    .order("fetched_at", { ascending: true })
    .limit(1000);
  return daily((data || []).map((r) => ({ t: r.fetched_at as string, v: Number(r.price) })));
}

type PumpPt = Pt & { slug: string; cat: string; title: string };
const EXCLUDE = /relief|levy|margin|increase|decrease|reduc|cut|rise|hike|change|drop|subsid|tax|difference|gap|per cent|%/i;

export async function fetchPump(): Promise<{ petrol: PumpPt[]; diesel: PumpPt[] }> {
  const { data } = await supabase
    .from("articles")
    .select("slug, category_slug, title, published_at, key_data")
    .eq("is_published", true)
    .or("title.ilike.%fuel%,title.ilike.%petrol%,title.ilike.%diesel%,title.ilike.%pump%")
    .order("published_at", { ascending: true })
    .limit(500);
  const petrol: PumpPt[] = [];
  const diesel: PumpPt[] = [];
  (data || []).forEach((a: any) => {
    const kd = Array.isArray(a.key_data) ? a.key_data : [];
    kd.forEach((k: any) => {
      const label = String(k?.label || "");
      const unit = String(k?.unit || "");
      const text = `${label} ${unit}`;
      if (!/GHS|cedi|GH₵/i.test(unit) || !/litre/i.test(text) || EXCLUDE.test(label)) return;
      const v = parseFloat(String(k?.value ?? "").replace(/[^0-9.]/g, ""));
      if (!isFinite(v) || v < 5 || v > 60) return;
      const pt = { date: String(a.published_at).slice(0, 10), value: v, slug: a.slug, cat: a.category_slug, title: a.title };
      if (/petrol|gasoline/i.test(label)) petrol.push(pt);
      else if (/diesel|gasoil/i.test(label)) diesel.push(pt);
    });
  });
  const dedupe = (arr: PumpPt[]) => {
    const m = new Map<string, PumpPt>();
    arr.forEach((p) => m.set(p.date, p));
    return [...m.values()];
  };
  return { petrol: dedupe(petrol), diesel: dedupe(diesel) };
}

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

const FuelCediTracker = () => {
  const usd = useQuery({ queryKey: ["fct-fx", "USD"], queryFn: () => fetchFx("USD") });
  const eur = useQuery({ queryKey: ["fct-fx", "EUR"], queryFn: () => fetchFx("EUR") });
  const gbp = useQuery({ queryKey: ["fct-fx", "GBP"], queryFn: () => fetchFx("GBP") });
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
        <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">
          The cedi's exchange rate, world crude prices and Ghana's pump prices, from stored observations only.
          Where history is short we say when tracking started rather than fill gaps.
        </p>

        <ChartCard embed="usd" title="US dollar to cedi (USD/GHS)" unit="GHS per US$" points={usd.data} source="open.er-api.com" sourceHref="https://open.er-api.com" />
        <ChartCard embed="eur" title="Euro to cedi (EUR/GHS)" unit="GHS per €" points={eur.data} source="open.er-api.com" sourceHref="https://open.er-api.com" />
        <ChartCard embed="gbp" title="Pound to cedi (GBP/GHS)" unit="GHS per £" points={gbp.data} source="open.er-api.com" sourceHref="https://open.er-api.com" />
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
