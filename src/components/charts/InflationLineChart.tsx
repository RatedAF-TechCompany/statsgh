"use client";
// Recharts line chart for the inflation explainer, split out of views/InflationTracker so the
// CPI page does not ship recharts (~95 KB gz) in its initial JS. Loaded lazily (ssr: false).
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export type InflationLine = { key: string; name: string; color: string };
const InflationLineChart = ({ data, lines, monthLabel, minTickGap, legend, dot }: {
  data: Record<string, any>[]; lines: InflationLine[]; monthLabel: (p: string) => string; minTickGap?: number; legend?: boolean; dot?: boolean;
}) => {
  const nameOf = (k: string) => lines.find((l) => l.key === k)?.name || k;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#E8E8E8" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={monthLabel} minTickGap={minTickGap} />
        <YAxis tick={{ fontSize: 11 }} width={40} unit="%" />
        <Tooltip labelFormatter={(d) => monthLabel(String(d))} formatter={(v: number, n: string) => [`${v}%`, nameOf(n)]} />
        {legend && <Legend formatter={(n) => nameOf(String(n))} />}
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} connectNulls={!!dot} dot={!!dot} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
export default InflationLineChart;
