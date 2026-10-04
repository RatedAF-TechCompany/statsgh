"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { KeyNumbersBox, Methodology, PageShell, ShareRow, TimeChart } from "@/components/markets/MarketBits";
import { GseTicker } from "@/components/markets/GseTicker";
import { downloadCsv, fmtDay } from "@/lib/bogRates";
import { GSE_LABEL, GSE_URL, fetchGseIndex, fetchLatestGse, nameOf, sectorOf, pct, ghs, intl, changeCls, type GsePrice } from "@/lib/gse";

type SortKey = "symbol" | "sector" | "close" | "change_percent" | "volume" | "value_traded";

const MiniList = ({ title, rows, metric }: { title: string; rows: GsePrice[]; metric: "pct" | "vol" }) => (
  <section className="border-t-2 border-[#121212] pt-2">
    <h2 className="kicker mb-2">{title}</h2>
    {rows.length === 0 ? <p className="text-sm text-[#5B5B5B]">None on this day.</p> : (
      <ol className="text-sm divide-y divide-[#EFEFEF]">
        {rows.map((r) => (
          <li key={r.symbol} className="flex justify-between py-1.5">
            <Link to={`/markets/gse/${r.symbol}`} className="hover:underline"><b>{r.symbol}</b> <span className="text-[#5B5B5B]">{ghs(r.close)}</span></Link>
            {metric === "pct" ? <span className={changeCls(r.change_percent)}>{pct(r.change_percent)}</span> : <span>{intl(r.volume)}</span>}
          </li>
        ))}
      </ol>
    )}
  </section>
);

const GseMarket = () => {
  const prices = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse });
  const index = useQuery({ queryKey: ["gse-index"], queryFn: () => fetchGseIndex(250) });
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "volume", dir: -1 });

  const rows = prices.data || [];
  const day = rows[0]?.trade_date;
  const idx = index.data || [];
  const li = idx[idx.length - 1];
  const pi = idx[idx.length - 2];
  const ciCh = li?.gse_ci && pi?.gse_ci ? ((li.gse_ci - pi.gse_ci) / pi.gse_ci) * 100 : null;
  const fsiCh = li?.gse_fsi && pi?.gse_fsi ? ((li.gse_fsi - pi.gse_fsi) / pi.gse_fsi) * 100 : null;

  const traded = rows.filter((r) => r.change_percent != null);
  const gainers = traded.filter((r) => r.change_percent! > 0).sort((a, b) => b.change_percent! - a.change_percent!).slice(0, 5);
  const losers = traded.filter((r) => r.change_percent! < 0).sort((a, b) => a.change_percent! - b.change_percent!).slice(0, 5);
  const active = rows.filter((r) => (r.volume ?? 0) > 0).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5);
  const sectors = useMemo(() => ["All", ...[...new Set(rows.map(sectorOf))].sort()], [rows]);

  const bySector = useMemo(() => {
    const m = new Map<string, { n: number; up: number; down: number; value: number; sum: number }>();
    rows.forEach((r) => {
      const s = m.get(sectorOf(r)) || { n: 0, up: 0, down: 0, value: 0, sum: 0 };
      s.n++; s.value += r.value_traded ?? 0; s.sum += r.change_percent ?? 0;
      if ((r.change_percent ?? 0) > 0) s.up++; if ((r.change_percent ?? 0) < 0) s.down++;
      m.set(sectorOf(r), s);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [rows]);

  const table = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => (sector === "All" || sectorOf(r) === sector) && (!t || r.symbol.toLowerCase().includes(t) || nameOf(r).toLowerCase().includes(t)))
      .sort((a, b) => {
        const av = a[sort.k] as any, bv = b[sort.k] as any;
        if (sort.k === "symbol" || sort.k === "sector") return String(av ?? "").localeCompare(String(bv ?? "")) * sort.dir;
        return ((av ?? -Infinity) - (bv ?? -Infinity)) * sort.dir;
      });
  }, [rows, q, sector, sort]);

  const th = (k: SortKey, label: string, right = true) => (
    <th className={`py-2 px-2 cursor-pointer select-none ${right ? "text-right" : "text-left"}`} onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : -1 })}>
      {label}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  const totalValue = rows.reduce((s, r) => s + (r.value_traded ?? 0), 0);
  const keyItems = [
    li?.gse_ci != null && { label: "GSE Composite Index", value: li.gse_ci.toLocaleString("en-GB", { maximumFractionDigits: 2 }), note: ciCh != null ? `${pct(ciCh)} on previous session` : undefined },
    li?.gse_fsi != null && { label: "GSE Financial Stocks Index", value: li.gse_fsi.toLocaleString("en-GB", { maximumFractionDigits: 2 }), note: fsiCh != null ? `${pct(fsiCh)} on previous session` : undefined },
    li?.market_cap_m != null && { label: "Market capitalisation", value: `GH₵${(li.market_cap_m / 1000).toFixed(1)}bn` },
    rows.length > 0 && { label: "Gainers / losers", value: `${traded.filter((r) => r.change_percent! > 0).length} / ${traded.filter((r) => r.change_percent! < 0).length}`, note: `Value traded GH₵${intl(Math.round(totalValue))}` },
  ].filter(Boolean) as { label: string; value: string; note?: string }[];

  const chart = idx.filter((r) => r.gse_ci).map((r) => ({ date: r.trade_date, ci: r.gse_ci }));

  return (
    <PageShell wide kicker={<><Link to="/markets-data" className="hover:underline">Markets &amp; Data</Link> · Markets</>} title="Ghana Stock Exchange"
      intro="End-of-day share prices, index levels and trading volumes for every equity on the Ghana Stock Exchange. Figures are delayed, not real-time.">
      <nav className="font-ui text-[12px] flex gap-4 mb-2">
        <Link to="/markets/forex" className="underline text-[#E3120B]">Forex</Link>
        <Link to="/markets/rates" className="underline text-[#E3120B]">Interest rates</Link>
        <span className="font-bold">GSE</span>
      </nav>
      <GseTicker />

      {prices.isLoading || index.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (
        <KeyNumbersBox items={keyItems} source={GSE_LABEL} sourceHref={GSE_URL} asOf={li?.trade_date || day} />
      )}
      {day && <p className="font-ui text-[12px] text-[#5B5B5B]">Last updated {fmtDay(day)} (end of trading day). If the exchange's site is unavailable, the last good snapshot stays on this page.</p>}
      {li?.gse_ci && <ShareRow text={`GSE Composite Index closed at ${li.gse_ci.toLocaleString("en-GB")} (${fmtDay(li.trade_date)})`} path="/markets/gse" />}

      {chart.length > 1 && (
        <section className="py-4">
          <h2 className="kicker mb-2">GSE Composite Index</h2>
          <TimeChart data={chart} series={[{ key: "ci", name: "GSE-CI", color: "#E3120B" }]} unit="pts" />
          <p className="font-ui text-[11px] text-[#5B5B5B]">Source: <a className="underline" href={GSE_URL} target="_blank" rel="noopener noreferrer">{GSE_LABEL}</a> · {fmtDay(chart[0].date)} to {fmtDay(chart[chart.length - 1].date)}</p>
        </section>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid md:grid-cols-3 gap-6 py-4">
            <MiniList title="Top gainers" rows={gainers} metric="pct" />
            <MiniList title="Top losers" rows={losers} metric="pct" />
            <MiniList title="Most active (volume)" rows={active} metric="vol" />
          </div>

          <section className="py-4">
            <h2 className="kicker mb-2">Sector breakdown · {fmtDay(day!)}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-ui">
                <thead className="border-b border-[#121212] text-[11px] uppercase text-[#5B5B5B]"><tr><th className="text-left py-2 px-2">Sector</th><th className="text-right px-2">Stocks</th><th className="text-right px-2">Up / down</th><th className="text-right px-2">Avg change</th><th className="text-right px-2">Value traded</th></tr></thead>
                <tbody className="divide-y divide-[#EFEFEF]">
                  {bySector.map(([s, v]) => (
                    <tr key={s} className="cursor-pointer hover:bg-[#F6F6F6]" onClick={() => setSector(s)}>
                      <td className="py-1.5 px-2">{s}</td><td className="text-right px-2">{v.n}</td><td className="text-right px-2">{v.up} / {v.down}</td>
                      <td className={`text-right px-2 ${changeCls(v.sum / v.n)}`}>{pct(v.sum / v.n)}</td><td className="text-right px-2">GH₵{intl(Math.round(v.value))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="py-4">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="kicker">All equities</h2>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or company" className="border border-[#D9D9D9] px-2 py-1 text-sm" aria-label="Search stocks" />
              <select value={sector} onChange={(e) => setSector(e.target.value)} className="border border-[#D9D9D9] px-2 py-1 text-sm" aria-label="Filter by sector">
                {sectors.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="font-ui text-[12px] underline text-[#E3120B]" onClick={() => downloadCsv(`gse-${day}.csv`,
                [["date", "symbol", "company", "sector", "close_ghs", "previous_close_ghs", "change_pct", "volume", "value_traded_ghs", "source"],
                 ...table.map((r) => [r.trade_date, r.symbol, nameOf(r), sectorOf(r), r.close, r.previous_close ?? "", r.change_percent ?? "", r.volume ?? "", r.value_traded ?? "", r.source_url])])}>Download CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-ui">
                <thead className="border-b border-[#121212] text-[11px] uppercase text-[#5B5B5B]">
                  <tr>{th("symbol", "Symbol", false)}<th className="text-left px-2">Company</th>{th("sector", "Sector", false)}{th("close", "Close")}<th className="text-right px-2">Prev.</th>{th("change_percent", "Change")}{th("volume", "Volume")}{th("value_traded", "Value (GH₵)")}</tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEF]">
                  {table.map((r) => (
                    <tr key={r.symbol}>
                      <td className="py-1.5 px-2 font-bold"><Link to={`/markets/gse/${r.symbol}`} className="underline text-[#E3120B]">{r.symbol}</Link></td>
                      <td className="px-2">{nameOf(r)}</td><td className="px-2 text-[#5B5B5B]">{sectorOf(r)}</td>
                      <td className="text-right px-2">{r.close.toFixed(2)}</td><td className="text-right px-2 text-[#5B5B5B]">{r.previous_close?.toFixed(2) ?? "—"}</td>
                      <td className={`text-right px-2 ${changeCls(r.change_percent)}`}>{pct(r.change_percent)}</td>
                      <td className="text-right px-2">{intl(r.volume)}</td><td className="text-right px-2">{intl(r.value_traded)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {!prices.isLoading && rows.length === 0 && <p className="font-serif text-[17px] text-[#5B5B5B] py-4">Data unavailable — no GSE snapshot stored yet.</p>}

      <Methodology>
        <p>Prices come from the Ghana Stock Exchange's public "Trading and data" tables, collected by StatsGH twice each trading day (about 15:30 and 17:30 Accra time). If that site is unavailable we try an unofficial GSE feed (dev.kwayisi.org) and label it as such. If both fail, nothing is overwritten.</p>
        <p>"Close" is the GSE closing price (volume-weighted average). Change is close versus the previous close. These are end-of-day, delayed figures; official real-time GSE data is a paid service and is not shown here.</p>
        <p>Company names and sectors are StatsGH reference labels; stocks without a label show as "Unclassified". Our own price history starts from the earliest snapshot stored.</p>
      </Methodology>
    </PageShell>
  );
};

export default GseMarket;
