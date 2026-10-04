"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchLatestGse, pct, changeCls } from "@/lib/gse";
import { fmtDay } from "@/lib/bogRates";

/** Compact GSE strip for markets pages; hidden when no snapshot is stored. */
export const GseTicker = () => {
  const { data } = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse });
  const rows = (data || []).filter((r) => (r.volume ?? 0) > 0).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 12);
  if (!rows.length) return null;
  return (
    <div className="border-y border-[#D9D9D9] bg-[#F6F6F6] font-ui text-[12px] flex items-center gap-4 overflow-x-auto whitespace-nowrap px-3 py-1.5 my-3">
      <Link to="/markets/gse" className="font-bold">GSE · end-of-day {fmtDay(data![0].trade_date)}</Link>
      {rows.map((r) => (
        <Link key={r.symbol} to={`/markets/gse/${r.symbol}`} className="hover:underline">
          {r.symbol} {r.close.toFixed(2)} <span className={changeCls(r.change_percent)}>{pct(r.change_percent)}</span>
        </Link>
      ))}
    </div>
  );
};
