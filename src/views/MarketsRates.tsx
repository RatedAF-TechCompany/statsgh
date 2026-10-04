"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BOG_SOURCE, BOG_URLS, downloadCsv, fetchInterbank, fetchPolicy, fetchTbills, fmtDay, latestTbill } from "@/lib/bogRates";
import { KeyNumbersBox, Methodology, PageShell, ShareRow, TimeChart } from "@/components/markets/MarketBits";

const Src = ({ href, label }: { href: string; label: string }) => (
  <p className="text-xs text-[#5B5B5B] mt-1">Source: <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{BOG_SOURCE} — {label}</a></p>
);

const MarketsRates = () => {
  const tb = useQuery({ queryKey: ["bog-tbills"], queryFn: fetchTbills });
  const pol = useQuery({ queryKey: ["bog-policy"], queryFn: fetchPolicy });
  const ib = useQuery({ queryKey: ["bog-interbank"], queryFn: fetchInterbank });

  const t91 = tb.data ? latestTbill(tb.data, 91) : null;
  const t182 = tb.data ? latestTbill(tb.data, 182) : null;
  const t364 = tb.data ? latestTbill(tb.data, 364) : null;
  const policy = pol.data?.[pol.data.length - 1];
  const prevPolicy = pol.data?.[pol.data.length - 2];
  const inter = ib.data?.[ib.data.length - 1];

  const tbChart = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    (tb.data || []).forEach((r) => { const o = m.get(r.issue_date) || { date: r.issue_date }; o[`t${r.tenor_days}`] = r.interest_rate; m.set(r.issue_date, o); });
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [tb.data]);
  const latestAuction = useMemo(() => {
    const d = tb.data?.[tb.data.length - 1]?.issue_date;
    return d ? tb.data!.filter((r) => r.issue_date === d).sort((a, b) => a.tenor_days - b.tenor_days) : [];
  }, [tb.data]);
  const polChart = (pol.data || []).map((r) => ({ date: r.effective_date, rate: r.rate }));
  const ibChart = (ib.data || []).map((r) => ({ date: r.rate_date, rate: r.rate }));

  const chg = (a?: number | null, b?: number | null) => (a != null && b != null ? `${a - b >= 0 ? "+" : ""}${(a - b).toFixed(2)} pts vs previous` : undefined);
  const items = [
    t91 && { label: "91-day T-bill", value: `${t91.value.toFixed(2)}%`, note: chg(t91.value, t91.prev) },
    t182 && { label: "182-day T-bill", value: `${t182.value.toFixed(2)}%`, note: chg(t182.value, t182.prev) },
    t364 && { label: "364-day T-bill", value: `${t364.value.toFixed(2)}%`, note: chg(t364.value, t364.prev) },
    policy && { label: "Policy rate", value: `${policy.rate.toFixed(1)}%`, note: `Since ${fmtDay(policy.effective_date)}` },
  ].filter(Boolean) as { label: string; value: string; note?: string }[];

  return (
    <PageShell
      wide
      kicker={<><Link to="/markets-data" className="hover:underline">Markets &amp; Data</Link> · Markets</>}
      title="Interest rates: T-bills, policy rate, interbank"
      intro="Ghana's benchmark interest rates as published by the Bank of Ghana: weekly Treasury bill auction results, the Monetary Policy Committee's policy rate, and the interbank lending rate."
    >
      <nav className="font-ui text-[12px] flex gap-4 mb-2">
        <Link to="/markets/forex" className="underline text-[#E3120B]">Forex</Link>
        <span className="font-bold">Interest rates</span>
        <Link to="/trackers/inflation" className="underline text-[#E3120B]">Inflation</Link>
      </nav>

      {tb.isLoading || pol.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (
        <KeyNumbersBox items={items} source={`${BOG_SOURCE} — Treasury bill rates and policy rate`} sourceHref={BOG_URLS.tbills} asOf={t91?.date} />
      )}
      {t91 && <ShareRow text={`Ghana 91-day T-bill rate: ${t91.value.toFixed(2)}% (auction of ${fmtDay(t91.date)})${policy ? `; BoG policy rate ${policy.rate}%` : ""}`} path="/markets/rates" />}

      <section className="border-t border-[#D9D9D9] py-6">
        <h2 className="kicker mb-2">Treasury bill interest rates</h2>
        {tbChart.length > 1 ? (
          <>
            <TimeChart data={tbChart} unit="%" series={[{ key: "t91", name: "91-day", color: "#E3120B" }, { key: "t182", name: "182-day", color: "#1F5C99" }, { key: "t364", name: "364-day", color: "#2E8B57" }]} />
            <p className="text-xs text-[#5B5B5B] mt-1">Tracking started {fmtDay(tbChart[0].date)} · {tbChart.length} auctions stored. The Bank of Ghana page lists recent auctions only, so history grows week by week.</p>
          </>
        ) : <p className="font-serif text-[17px] text-[#5B5B5B]">{tb.data?.length ? "Not enough auctions stored for a chart yet." : "Data unavailable."}</p>}
        {latestAuction.length > 0 && (
          <div className="mt-4">
            <h3 className="font-ui text-[12px] font-bold uppercase tracking-wide mb-1">Latest auction · issue date {fmtDay(latestAuction[0].issue_date)}</h3>
            <table className="w-full font-ui text-[13px]">
              <thead><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]"><th className="py-1">Tenor</th><th>Tender</th><th className="text-right">Discount rate</th><th className="text-right">Interest rate</th></tr></thead>
              <tbody>{latestAuction.map((r) => (
                <tr key={r.tenor_days} className="border-b border-[#EEE]"><td className="py-1">{r.tenor_days}-day</td><td>{r.tender_no ?? "—"}</td><td className="text-right">{r.discount_rate?.toFixed(4) ?? "—"}%</td><td className="text-right font-semibold">{r.interest_rate.toFixed(4)}%</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {!!tb.data?.length && <button className="font-ui text-[12px] underline text-[#E3120B] mt-2" onClick={() => downloadCsv("statsgh-bog-tbill-rates.csv", ["issue_date", "tender", "tenor_days", "discount_rate", "interest_rate", "source_url"], tb.data!.map((r) => [r.issue_date, r.tender_no, r.tenor_days, r.discount_rate, r.interest_rate, r.source_url]))}>Download CSV</button>}
        <Src href={BOG_URLS.tbills} label="Treasury bill rates" />
      </section>

      <section className="border-t border-[#D9D9D9] py-6">
        <h2 className="kicker mb-2">Bank of Ghana policy rate</h2>
        {policy && <p className="font-serif text-[17px] mb-2"><strong>{policy.rate.toFixed(1)}%</strong> since {fmtDay(policy.effective_date)} (MPC meeting {policy.meeting_no}{policy.mpc_dates ? `, ${policy.mpc_dates}` : ""}){prevPolicy ? `; previously ${prevPolicy.rate.toFixed(1)}%.` : "."}</p>}
        {polChart.length > 1 ? <TimeChart data={polChart} unit="%" step dp={1} series={[{ key: "rate", name: "Policy rate", color: "#E3120B" }]} /> : <p className="font-serif text-[17px] text-[#5B5B5B]">Data unavailable.</p>}
        {!!pol.data?.length && (
          <details className="mt-3">
            <summary className="font-ui text-[12px] cursor-pointer underline text-[#E3120B]">All {pol.data.length} MPC decisions</summary>
            <div className="max-h-[360px] overflow-y-auto mt-2">
              <table className="w-full font-ui text-[13px]">
                <thead className="sticky top-0 bg-white"><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]"><th className="py-1">Meeting</th><th>MPC dates</th><th>Effective</th><th className="text-right">Rate</th></tr></thead>
                <tbody>{pol.data.slice().reverse().map((r) => (
                  <tr key={r.meeting_no} className="border-b border-[#EEE]"><td className="py-1">{r.meeting_no}</td><td>{r.mpc_dates}</td><td>{fmtDay(r.effective_date)}</td><td className="text-right font-semibold">{r.rate}%</td></tr>
                ))}</tbody>
              </table>
            </div>
            <button className="font-ui text-[12px] underline text-[#E3120B] mt-2" onClick={() => downloadCsv("statsgh-bog-policy-rate.csv", ["meeting_no", "mpc_dates", "effective_date", "rate", "source_url"], pol.data!.map((r) => [r.meeting_no, r.mpc_dates, r.effective_date, r.rate, r.source_url]))}>Download CSV</button>
          </details>
        )}
        <Src href={BOG_URLS.policy} label="Policy rate trends" />
      </section>

      <section className="border-t border-[#D9D9D9] py-6">
        <h2 className="kicker mb-2">Interbank interest rate</h2>
        {inter && <p className="font-serif text-[17px] mb-2"><strong>{inter.rate.toFixed(2)}%</strong> on {fmtDay(inter.rate_date)}</p>}
        {ibChart.length > 1 ? <TimeChart data={ibChart} unit="%" series={[{ key: "rate", name: "Interbank rate", color: "#1F5C99" }]} /> : <p className="font-serif text-[17px] text-[#5B5B5B]">Data unavailable.</p>}
        <Src href={BOG_URLS.interbank} label="Interbank interest rates" />
      </section>

      <Methodology>
        <p>All figures are read once a day from the Bank of Ghana's own tables and stored with the dates the Bank gives. T-bill rates come from the weekly primary auction, and the interest rate shown is the Bank's quoted yield. Policy rate dates are the effective dates of Monetary Policy Committee decisions.</p>
        <p>If a fetch fails, the page keeps the last good figures and shows their dates. It never fills in estimates.</p>
      </Methodology>
    </PageShell>
  );
};
export default MarketsRates;
