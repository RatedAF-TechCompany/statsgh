"use client";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchFx, fetchBrent, fetchPump } from "@/views/FuelCediTracker";

export const EMBED_SERIES: Record<string, { title: string; unit: string; source: string; load: () => Promise<{ date: string; value: number }[]> }> = {
  usd: { title: "US dollar to cedi", unit: "GHS per US$", source: "open.er-api.com", load: () => fetchFx("USD") },
  eur: { title: "Euro to cedi", unit: "GHS per €", source: "open.er-api.com", load: () => fetchFx("EUR") },
  gbp: { title: "Pound to cedi", unit: "GHS per £", source: "open.er-api.com", load: () => fetchFx("GBP") },
  brent: { title: "Brent crude", unit: "US$ per barrel", source: "FRED (EIA) DCOILBRENTEU", load: fetchBrent },
  petrol: { title: "Ghana petrol pump price", unit: "GHS per litre", source: "Figures cited in StatsGH articles", load: async () => (await fetchPump()).petrol },
  diesel: { title: "Ghana diesel pump price", unit: "GHS per litre", source: "Figures cited in StatsGH articles", load: async () => (await fetchPump()).diesel },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const EmbedChart = ({ series }: { series: string }) => {
  const cfg = EMBED_SERIES[series];
  const { data, isLoading } = useQuery({ queryKey: ["embed", series], queryFn: cfg?.load ?? (async () => []), enabled: !!cfg });
  if (!cfg) return <p className="p-4 font-ui text-sm">Chart not found.</p>;
  const last = data?.[data.length - 1];
  return (
    <div className="bg-white p-3 font-ui h-screen flex flex-col">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-lg font-bold text-[#121212]">{cfg.title}</h1>
        {last && <span className="font-serif text-xl font-bold">{last.value.toFixed(2)} <span className="text-xs font-normal text-[#5B5B5B]">{cfg.unit}</span></span>}
      </div>
      <div className="flex-1 min-h-[160px]">
        {isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : !data?.length ? (
          <p className="text-sm text-[#5B5B5B]">Data unavailable — no stored observations yet.</p>
        ) : data.length < 2 ? (
          <p className="text-sm text-[#5B5B5B]">Tracking started {fmt(data[0].date)} — a chart will appear once more observations are stored.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#E8E8E8" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => fmt(d).replace(/ \d{4}$/, "")} minTickGap={40} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={44} />
              <Tooltip labelFormatter={(d) => fmt(String(d))} />
              <Line type="monotone" dataKey="value" stroke="#E3120B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[11px] text-[#5B5B5B] mt-1">
        Source: {cfg.source}{last ? ` · Last updated ${fmt(last.date)}` : ""} ·{" "}
        <a href="https://statsgh.com/trackers/fuel-and-cedi" target="_blank" rel="noopener noreferrer" className="text-[#E3120B] font-semibold">StatsGH</a>
      </p>
    </div>
  );
};

export default EmbedChart;
