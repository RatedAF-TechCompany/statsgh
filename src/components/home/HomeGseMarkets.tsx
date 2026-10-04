"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchLatestGse, ghs, GSE_LABEL, GSE_URL, pct } from "@/lib/gse";
import { fmtDay } from "@/lib/bogRates";

export const HomeGseMarkets = () => {
  const { data } = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse, staleTime: 10 * 60_000 });
  const priced = (data || []).filter((row) => row.change_percent != null);
  if (!priced.length) return null;

  const gainers = [...priced].filter((row) => Number(row.change_percent) > 0).sort((a, b) => Number(b.change_percent) - Number(a.change_percent)).slice(0, 4);
  const losers = [...priced].filter((row) => Number(row.change_percent) < 0).sort((a, b) => Number(a.change_percent) - Number(b.change_percent)).slice(0, 4);
  if (!gainers.length && !losers.length) return null;
  const asOf = priced[0]?.trade_date;

  return (
    <section className="border-b border-[#D9D9D9] py-5 md:py-6" aria-labelledby="markets-title">
      <div className="mb-3 flex items-end justify-between gap-3 border-t-4 border-[#E3120B] pt-2">
        <h2 id="markets-title"><Link to="/markets/gse" className="font-ui text-[18px] font-bold text-[#0D0D0D] hover:text-[#E3120B]">Markets</Link></h2>
        <Link to="/markets/gse" className="font-ui text-[12px] font-semibold text-[#E3120B] hover:underline">All GSE data →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {[
          { label: "Gainers", rows: gainers },
          { label: "Losers", rows: losers },
        ].filter((group) => group.rows.length).map((group) => (
          <div key={group.label} className="min-w-0">
            <h3 className="mb-1 font-ui text-[11px] font-bold uppercase text-[#5B5B5B]">{group.label}</h3>
            {group.rows.map((row) => (
              <Link key={row.symbol} to={`/markets/gse/${row.symbol}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-[#D9D9D9] py-2 font-ui text-[12px] hover:text-[#E3120B]">
                <span className="truncate font-semibold">{row.symbol}<span className="ml-2 font-normal text-[#757575]">{row.name}</span></span>
                <span>{ghs(row.close)}</span>
                <span className={Number(row.change_percent) > 0 ? "text-[#1B7A3D]" : "text-[#E3120B]"}>{pct(row.change_percent)}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {asOf && <p className="mt-2 font-ui text-[9px] text-[#757575]">Source: <a href={GSE_URL} target="_blank" rel="noopener noreferrer" className="underline">{GSE_LABEL}</a> · as of {fmtDay(asOf)}</p>}
    </section>
  );
};