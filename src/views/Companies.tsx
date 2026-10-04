"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageShell, ShareRow, Methodology } from "@/components/markets/MarketBits";
import { fetchCompanies } from "@/lib/companies";
import { fetchLatestGse, GSE_LABEL, GSE_URL, ghs, pct, changeCls, sectorOf } from "@/lib/gse";
import { fmtDay } from "@/lib/bogRates";

const Companies = () => {
  const cos = useQuery({ queryKey: ["companies"], queryFn: fetchCompanies });
  const px = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse });
  const [q, setQ] = useState("");
  const bySym = useMemo(() => new Map((px.data || []).map((p) => [p.symbol, p])), [px.data]);
  const rows = (cos.data || []).filter((c) => !q || `${c.name} ${c.symbol} ${c.sector}`.toLowerCase().includes(q.toLowerCase()));
  const asOf = px.data?.[0]?.trade_date;
  return (
    <PageShell wide title="Companies" intro="Every company listed on the Ghana Stock Exchange, with its latest end-of-day price and all StatsGH reporting about it.">
      <ShareRow text="Ghana Stock Exchange company profiles on StatsGH" path="/companies" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, ticker or sector" aria-label="Search companies" className="border border-[#D9D9D9] px-3 h-9 font-ui text-[13px] w-full md:w-80 my-3" />
      {cos.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#121212] text-left font-ui text-[12px]"><th className="py-2">Company</th><th>Ticker</th><th className="hidden md:table-cell">Sector</th><th className="text-right">Close</th><th className="text-right">Change</th></tr></thead>
          <tbody>{rows.map((c) => { const p = bySym.get(c.symbol); return (
            <tr key={c.symbol} className="border-b border-[#EFEFEF]">
              <td className="py-1.5"><Link to={`/companies/${c.slug}`} className="underline font-semibold">{c.name}</Link></td>
              <td><Link to={`/markets/gse/${c.symbol}`} className="hover:underline">{c.symbol}</Link></td>
              <td className="hidden md:table-cell">{c.sector || "Unclassified"}</td>
              <td className="text-right">{p ? ghs(p.close) : "—"}</td>
              <td className={`text-right ${changeCls(p?.change_percent)}`}>{p ? pct(p.change_percent) : "—"}</td>
            </tr>); })}</tbody>
        </table>
      )}
      <p className="font-ui text-[11px] text-[#5B5B5B] mt-2">Prices: <a href={GSE_URL} className="underline" target="_blank" rel="noopener noreferrer">{GSE_LABEL}</a>{asOf ? `, as of ${fmtDay(asOf)}` : ""}. Not real-time.</p>
      <Methodology>The list comes from the companies in our own daily GSE price snapshots. Names and sectors are StatsGH reference labels. We do not publish revenue, profit or other financials unless they appear in our own sourced reporting.</Methodology>
    </PageShell>
  );
};
export default Companies;
export { sectorOf };
