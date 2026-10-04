"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageShell, ShareRow, Methodology } from "@/components/markets/MarketBits";
import { fetchLatestGse, fetchGseHistory, GSE_LABEL, GSE_URL, ghs, pct, changeCls, nameOf } from "@/lib/gse";
import { fetchCompanies } from "@/lib/companies";
import { downloadCsv, fmtDay } from "@/lib/bogRates";

const TopListed = () => {
  const latest = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse });
  const cos = useQuery({ queryKey: ["companies"], queryFn: fetchCompanies });
  // 30-day move from our own snapshots
  const moves = useQuery({
    queryKey: ["gse-30d", latest.data?.length],
    enabled: !!latest.data?.length,
    queryFn: async () => {
      const out: Record<string, number | null> = {};
      await Promise.all((latest.data || []).map(async (p) => {
        const h = await fetchGseHistory(p.symbol);
        const cutoff = new Date(p.trade_date); cutoff.setDate(cutoff.getDate() - 30);
        const base = h.find((r) => new Date(r.trade_date) >= cutoff);
        out[p.symbol] = base && base.close > 0 ? ((p.close - base.close) / base.close) * 100 : null;
      }));
      return out;
    },
  });
  const slugOf = new Map((cos.data || []).map((c) => [c.symbol, c.slug]));
  const rows = (latest.data || []).map((p) => ({ p, m: moves.data?.[p.symbol] ?? null }))
    .sort((a, b) => (b.m ?? -Infinity) - (a.m ?? -Infinity));
  const asOf = latest.data?.[0]?.trade_date;
  return (
    <PageShell wide kicker="Rankings" title="Top listed companies" intro="GSE-listed companies ranked by share-price change over the last 30 days.">
      <p className="border-l-4 border-[#0F5499] bg-[#F2F7FC] p-3 font-ui text-[13px] mb-3">
        <strong>Why not market capitalisation?</strong> A market-cap ranking needs each company's number of shares outstanding. We have not yet found a reliable, regularly updated public source for that figure, so we rank by price move instead. We do not estimate market value or revenue.
      </p>
      <ShareRow text="GSE-listed companies ranked by 30-day share-price move" path="/rankings/top-listed-companies" />
      {latest.isLoading || moves.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (
        <>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#121212] text-left font-ui text-[12px]"><th className="py-2">#</th><th>Company</th><th className="text-right">Close</th><th className="text-right">Day</th><th className="text-right">30-day move</th></tr></thead>
            <tbody>{rows.map(({ p, m }, i) => (
              <tr key={p.symbol} className="border-b border-[#EFEFEF]">
                <td className="py-1.5">{i + 1}</td>
                <td><Link to={slugOf.get(p.symbol) ? `/companies/${slugOf.get(p.symbol)}` : `/markets/gse/${p.symbol}`} className="underline">{nameOf(p)}</Link> <span className="text-[#5B5B5B]">{p.symbol}</span></td>
                <td className="text-right">{ghs(p.close)}</td>
                <td className={`text-right ${changeCls(p.change_percent)}`}>{pct(p.change_percent)}</td>
                <td className={`text-right font-semibold ${changeCls(m)}`}>{pct(m)}</td>
              </tr>))}</tbody>
          </table>
          <button className="mt-2 font-ui text-[12px] underline text-[#E3120B]" onClick={() => downloadCsv("gse-30d-moves.csv", [["rank", "symbol", "close_ghs", "day_pct", "move_30d_pct"], ...rows.map(({ p, m }, i) => [i + 1, p.symbol, p.close, p.change_percent ?? "", m == null ? "" : m.toFixed(2)])])}>Download CSV</button>
        </>
      )}
      <p className="font-ui text-[11px] text-[#5B5B5B] mt-2">Source: <a href={GSE_URL} className="underline" target="_blank" rel="noopener noreferrer">{GSE_LABEL}</a>{asOf ? `, as of ${fmtDay(asOf)}` : ""}.</p>
      <Methodology>30-day move compares the latest close with the first close in StatsGH's own daily snapshots on or after 30 days earlier. Shares that did not trade keep their previous close, so a 0% move can mean no trades.</Methodology>
    </PageShell>
  );
};
export default TopListed;
