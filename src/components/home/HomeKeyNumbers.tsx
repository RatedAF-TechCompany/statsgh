"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchBogSnapshot, fmtDay } from "@/lib/bogRates";
import { fetchGseIndex, GSE_LABEL, GSE_URL } from "@/lib/gse";
import { supabase } from "@/integrations/supabase/client";

type NumberItem = {
  label: string;
  value: string;
  date: string;
  source: string;
  sourceUrl: string;
  href: string;
  change?: number | null;
};

async function fetchLatestCpi() {
  const { data, error } = await supabase
    .from("inflation_readings")
    .select("period,value,extracted_at")
    .eq("kind", "headline")
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const HomeKeyNumbers = () => {
  const { data } = useQuery({
    queryKey: ["homepage-key-numbers"],
    queryFn: async () => {
      const [bogResult, indexResult, cpiResult] = await Promise.allSettled([fetchBogSnapshot(), fetchGseIndex(2), fetchLatestCpi()]);
      return {
        bog: bogResult.status === "fulfilled" ? bogResult.value : null,
        indexes: indexResult.status === "fulfilled" ? indexResult.value : [],
        cpi: cpiResult.status === "fulfilled" ? cpiResult.value : null,
      };
    },
    staleTime: 10 * 60_000,
  });

  if (!data) return null;
  const latestIndex = data.indexes[data.indexes.length - 1];
  const previousIndex = data.indexes[data.indexes.length - 2];
  const indexChange = latestIndex?.gse_ci != null && previousIndex?.gse_ci
    ? ((latestIndex.gse_ci - previousIndex.gse_ci) / previousIndex.gse_ci) * 100
    : null;

  const items: NumberItem[] = [
    data.bog?.usd && {
      label: "USD/GHS",
      value: data.bog.usd.value.toFixed(4),
      date: data.bog.usd.date,
      source: "Bank of Ghana",
      sourceUrl: "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/",
      href: "/markets/forex",
    },
    data.bog?.t91 && {
      label: "91-day T-bill",
      value: `${data.bog.t91.value.toFixed(2)}%`,
      date: data.bog.t91.date,
      source: "Bank of Ghana",
      sourceUrl: "https://www.bog.gov.gh/treasury-and-the-markets/treasury-bill-rates/",
      href: "/markets/rates",
    },
    data.bog?.policy && {
      label: "Policy rate",
      value: `${data.bog.policy.value.toFixed(1)}%`,
      date: data.bog.policy.date,
      source: "Bank of Ghana",
      sourceUrl: "https://www.bog.gov.gh/monetary-policy/policy-rate-trends/",
      href: "/markets/rates",
    },
    latestIndex?.gse_ci != null && {
      label: "GSE Composite",
      value: `${latestIndex.gse_ci.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`,
      date: latestIndex.trade_date,
      source: GSE_LABEL,
      sourceUrl: GSE_URL,
      href: "/markets/gse",
      change: indexChange,
    },
    data.cpi && {
      label: "CPI inflation",
      value: `${Number(data.cpi.value).toFixed(1)}%`,
      date: data.cpi.period,
      source: "Ghana Statistical Service figure cited by StatsGH",
      sourceUrl: "/trackers/cpi",
      href: "/trackers/cpi",
    },
  ].filter(Boolean) as NumberItem[];

  if (!items.length) return null;

  return (
    <section className="border-b border-[#D9D9D9] py-4 md:py-5" aria-labelledby="key-numbers-title">
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 id="key-numbers-title" className="font-ui text-[13px] font-bold uppercase text-[#0D0D0D]">Key numbers today</h2>
        <Link to="/explorer" className="font-ui text-[12px] font-semibold text-[#E3120B] hover:underline">Explore data →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 border-t border-l border-[#D9D9D9]">
        {items.map((item) => (
          <Link key={item.label} to={item.href} className="min-w-0 border-r border-b border-[#D9D9D9] p-3 hover:bg-[#F6F6F6]">
            <span className="block font-ui text-[10px] font-bold uppercase text-[#5B5B5B]">{item.label}</span>
            <span className="mt-1 flex items-baseline gap-2 font-headline text-[22px] font-bold text-[#0D0D0D]">
              {item.value}
              {item.change != null && (
                <span className={`font-ui text-[11px] ${item.change > 0 ? "text-[#1B7A3D]" : item.change < 0 ? "text-[#E3120B]" : "text-[#5B5B5B]"}`}>
                  {item.change > 0 ? "+" : ""}{item.change.toFixed(2)}%
                </span>
              )}
            </span>
            <span className="mt-1 block truncate font-ui text-[9px] text-[#757575]" title={`${item.source} · ${fmtDay(item.date)}`}>
              {item.source} · {fmtDay(item.date)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};