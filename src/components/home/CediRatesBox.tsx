"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchBogSnapshot, fmtDay, BOG_URLS } from "@/lib/bogRates";

/** Daily "Cedi and rates" key numbers, built only from stored Bank of Ghana figures. */
export const CediRatesBox = () => {
  const { data } = useQuery({ queryKey: ["bog-snapshot"], queryFn: fetchBogSnapshot, staleTime: 10 * 60e3 });
  if (!data) return null;
  const rows = [
    data.usd && { k: "USD/GHS", v: data.usd.value.toFixed(4), d: data.usd.date, href: "/markets/forex" },
    data.gbp && { k: "GBP/GHS", v: data.gbp.value.toFixed(4), d: data.gbp.date, href: "/markets/forex" },
    data.eur && { k: "EUR/GHS", v: data.eur.value.toFixed(4), d: data.eur.date, href: "/markets/forex" },
    data.t91 && { k: "91-day T-bill", v: `${data.t91.value.toFixed(2)}%`, d: data.t91.date, href: "/markets/rates" },
    data.policy && { k: "Policy rate", v: `${data.policy.value.toFixed(1)}%`, d: data.policy.date, href: "/markets/rates" },
  ].filter(Boolean) as { k: string; v: string; d: string; href: string }[];
  if (!rows.length) return null;
  return (
    <div className="mb-5 border-t-4 border-[#E3120B] bg-[#F6F6F6] p-3" aria-label="Cedi and rates key numbers">
      <h3 className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#121212] mb-2">Key numbers: cedi and rates</h3>
      {rows.map((r) => (
        <Link key={r.k} to={r.href} className="flex justify-between py-1 border-t border-[#D9D9D9] font-ui text-[12px] hover:text-[#E3120B]">
          <span className="text-[#5B5B5B]">{r.k}</span>
          <span className="font-semibold text-[#121212]">{r.v} <span className="font-normal text-[10px] text-[#757575]">{fmtDay(r.d)}</span></span>
        </Link>
      ))}
      <p className="font-ui text-[9px] text-[#5B5B5B] mt-1">Source: <a href={BOG_URLS.fx} target="_blank" rel="noopener noreferrer" className="underline">Bank of Ghana</a></p>
    </div>
  );
};
