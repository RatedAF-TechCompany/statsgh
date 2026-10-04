"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchBogSnapshot, fmtDay, type Latest } from "@/lib/bogRates";

const Item = ({ label, l, pct, dp = 4 }: { label: string; l: Latest | null; pct?: boolean; dp?: number }) => {
  if (!l) return null; // missing values are hidden, never filled in
  const ch = l.prev != null ? l.value - l.prev : null;
  return (
    <span className="whitespace-nowrap">
      <span className="text-[#5B5B5B]">{label}</span>{" "}
      <span className="font-semibold text-[#121212]">{l.value.toFixed(dp)}{pct ? "%" : ""}</span>
      {ch != null && ch !== 0 && (
        <span className={ch > 0 ? "text-[#B30E08] ml-1" : "text-[#1B7A3D] ml-1"}>
          {ch > 0 ? "▲" : "▼"}{Math.abs(ch).toFixed(dp)}
        </span>
      )}
    </span>
  );
};

export const CediRateBar = () => {
  const { data } = useQuery({ queryKey: ["bog-snapshot"], queryFn: fetchBogSnapshot, staleTime: 10 * 60e3 });
  if (!data) return null;
  const dates = [data.usd, data.gbp, data.eur].filter(Boolean).map((l) => l!.date).sort();
  if (!dates.length && !data.t91 && !data.policy) return null;
  const asOf = dates.length ? dates[dates.length - 1] : (data.t91 || data.policy)!.date;
  return (
    <div className="bg-[#F6F6F6] border-b border-[#D9D9D9]" aria-label="Official Bank of Ghana rates">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-7 flex items-center gap-5 overflow-x-auto font-ui text-[11px]">
        <Link to="/markets/forex" className="font-bold uppercase tracking-[0.08em] text-[#E3120B] whitespace-nowrap hover:underline">Cedi rates</Link>
        <Item label="USD/GHS" l={data.usd} />
        <Item label="GBP/GHS" l={data.gbp} />
        <Item label="EUR/GHS" l={data.eur} />
        <Link to="/markets/rates" className="contents"><Item label="91-day T-bill" l={data.t91} pct dp={2} /></Link>
        <Link to="/markets/rates" className="contents"><Item label="Policy rate" l={data.policy} pct dp={1} /></Link>
        <span className="text-[#757575] whitespace-nowrap ml-auto">BoG, as of {fmtDay(asOf)}</span>
      </div>
    </div>
  );
};
