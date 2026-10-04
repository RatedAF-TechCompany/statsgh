"use client";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { KeyNumbersBox, Methodology, PageShell, ShareRow, TimeChart } from "@/components/markets/MarketBits";
import { GseTicker } from "@/components/markets/GseTicker";
import { downloadCsv, fmtDay } from "@/lib/bogRates";
import { GSE_LABEL, GSE_URL, fetchGseHistory, fetchLatestGse, nameOf, sectorOf, pct, ghs, intl, changeCls } from "@/lib/gse";

const GseStock = () => {
  const { symbol: raw } = useParams();
  const symbol = String(raw || "").toUpperCase();
  const hist = useQuery({ queryKey: ["gse-hist", symbol], queryFn: () => fetchGseHistory(symbol), enabled: !!symbol });
  const latestAll = useQuery({ queryKey: ["gse-latest"], queryFn: fetchLatestGse });
  const rows = hist.data || [];
  const l = rows[rows.length - 1];
  const name = l ? nameOf(l) : symbol;

  const related = useQuery({
    queryKey: ["gse-related", symbol, l?.name],
    enabled: !!l,
    queryFn: async () => {
      const terms = [l!.name ? `title.ilike.%${l!.name.replace(/[%,()]/g, "")}%` : null, symbol.length >= 3 ? `title.ilike.% ${symbol} %` : null].filter(Boolean).join(",");
      const { data } = await supabase.from("articles").select("id, title, slug, category_slug, published_at")
        .eq("is_published", true).or(terms).order("published_at", { ascending: false }).limit(6);
      return data || [];
    },
  });

  const peers = (latestAll.data || []).filter((p) => l?.sector && p.sector === l.sector && p.symbol !== symbol);

  if (hist.isLoading) return <PageShell title={symbol}><p className="text-sm text-[#5B5B5B]">Loading…</p></PageShell>;
  if (!l) return (
    <PageShell title={symbol} kicker={<Link to="/markets/gse" className="hover:underline">GSE</Link>}>
      <p className="font-serif text-[17px] text-[#5B5B5B] py-4">Data unavailable — no GSE prices are stored for "{symbol}". <Link to="/markets/gse" className="underline text-[#E3120B]">See all GSE stocks</Link>.</p>
    </PageShell>
  );

  const traded = rows.filter((r) => (r.volume ?? 0) > 0);
  return (
    <PageShell wide kicker={<><Link to="/markets/gse" className="hover:underline">Ghana Stock Exchange</Link> · {sectorOf(l)}</>} title={`${name} (${symbol})`}
      intro={`End-of-day share price for ${name} on the Ghana Stock Exchange. Delayed, not real-time.`}>
      <GseTicker />
      <KeyNumbersBox source={GSE_LABEL} sourceHref={l.source_url || GSE_URL} asOf={l.trade_date} items={[
        { label: "Closing price", value: ghs(l.close), note: l.previous_close != null ? `Previous ${ghs(l.previous_close)}` : undefined },
        { label: "Daily change", value: pct(l.change_percent) },
        { label: "Volume", value: intl(l.volume), note: l.value_traded != null ? `Value GH₵${intl(l.value_traded)}` : undefined },
        ...(l.year_high != null && l.year_low != null ? [{ label: "52-week range (GSE)", value: `${l.year_low.toFixed(2)}–${l.year_high.toFixed(2)}` }] : []),
      ]} />
      <p className="font-ui text-[12px] text-[#5B5B5B]">Last updated {fmtDay(l.trade_date)} · source: {l.source}</p>
      <ShareRow text={`${name} (${symbol}) closed at ${ghs(l.close)} on the GSE, ${pct(l.change_percent)} (${fmtDay(l.trade_date)})`} path={`/markets/gse/${symbol}`} />

      <section className="py-4">
        <h2 className="kicker mb-2">Price history</h2>
        {rows.length > 1 ? (
          <>
            <TimeChart data={rows.map((r) => ({ date: r.trade_date, close: r.close }))} series={[{ key: "close", name: "Close", color: "#E3120B" }]} unit="GH₵" />
            <p className="font-ui text-[11px] text-[#5B5B5B]">StatsGH snapshots from {fmtDay(rows[0].trade_date)} ({rows.length} trading days, {traded.length} with trades). The chart grows each trading day. ·{" "}
              <button className="underline text-[#E3120B]" onClick={() => downloadCsv(`${symbol}-gse.csv`, [["date", "close_ghs", "change_pct", "volume"], ...rows.map((r) => [r.trade_date, r.close, r.change_percent ?? "", r.volume ?? ""])])}>Download CSV</button></p>
          </>
        ) : <p className="text-sm text-[#5B5B5B]">Tracking started {fmtDay(rows[0].trade_date)}; a chart appears once two trading days are stored.</p>}
      </section>

      {peers.length > 0 && (
        <section className="py-4">
          <h2 className="kicker mb-2">Sector peers · {sectorOf(l)}</h2>
          <ul className="text-sm divide-y divide-[#EFEFEF]">
            {peers.map((p) => (
              <li key={p.symbol} className="flex justify-between py-1.5">
                <Link to={`/markets/gse/${p.symbol}`} className="underline">{p.symbol} — {nameOf(p)}</Link>
                <span>{ghs(p.close)} <span className={changeCls(p.change_percent)}>{pct(p.change_percent)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(related.data?.length ?? 0) > 0 && (
        <section className="py-4">
          <h2 className="kicker mb-2">Related StatsGH stories</h2>
          <ul className="space-y-2">
            {related.data!.map((a: any) => (
              <li key={a.id}><Link to={`/${a.category_slug}/${a.slug}`} className="font-serif text-[16px] underline hover:text-[#E3120B]">{a.title}</Link> <span className="font-ui text-[11px] text-[#5B5B5B]">{fmtDay(a.published_at)}</span></li>
            ))}
          </ul>
        </section>
      )}

      <Methodology>
        <p>Prices are the Ghana Stock Exchange's published end-of-day figures, collected by StatsGH twice each trading day. "Close" is the GSE closing price (volume-weighted average); change compares it with the previous close. Days with no trades repeat the last price.</p>
        <p>Related stories are matched on the company name or ticker in headlines, so some may mention the company only in passing.</p>
      </Methodology>
    </PageShell>
  );
};

export default GseStock;
