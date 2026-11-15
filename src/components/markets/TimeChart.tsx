"use client";
// Recharts time chart, split out of MarketBits so pages that only need PageShell/ShareRow
// (article, not-found, info pages) do not download recharts (~95 KB gz). Loaded lazily.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { fmtDay } from "@/lib/bogRates";

export type Series = { key: string; name: string; color: string };
export const TimeChart = ({ data, series, unit, dp = 2, step, yearly }: { data: Record<string, any>[]; series: Series[]; unit: string; dp?: number; step?: boolean; yearly?: boolean }) => (
  <div className="h-60 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#E8E8E8" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => (yearly ? String(d).slice(0, 4) : fmtDay(String(d)))} minTickGap={yearly ? 20 : 50} />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={48} />
        <Tooltip labelFormatter={(d) => (yearly ? String(d).slice(0, 4) : fmtDay(String(d)))} formatter={(v: number, n: string) => [`${Number(v).toFixed(dp)} ${unit}`, n]} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => (
          <Line key={s.key} type={step ? "stepAfter" : "monotone"} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);
export default TimeChart;
