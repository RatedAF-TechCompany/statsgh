"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { KeyNumbersBox, Methodology, PageShell, ShareRow, TimeChart } from "@/components/markets/MarketBits";
import { downloadCsv } from "@/lib/bogRates";
import { byYear, fetchMacro, latestActual, year, type MacroPoint } from "@/lib/macro";

const KEYS = ["imf_debt", "imf_balance", "wb_revenue", "wb_expense", "wb_balance"];
const src = (p?: MacroPoint) => p && <a className="underline" href={p.source_url} target="_blank" rel="noopener noreferrer">{p.source}</a>;

const BudgetDebt = () => {
  const { data, isLoading } = useQuery({ queryKey: ["macro", "budget"], queryFn: () => fetchMacro(KEYS) });
  const d = data || ({} as Record<string, MacroPoint[]>);
  const debt = latestActual(d.imf_debt), bal = latestActual(d.imf_balance), rev = latestActual(d.wb_revenue), exp = latestActual(d.wb_expense);
  const items = [
    debt && { label: `Public debt / GDP ${year(debt.period)}`, value: `${debt.value.toFixed(1)}%`, note: "IMF WEO, general government gross debt" },
    bal && { label: `Budget balance / GDP ${year(bal.period)}`, value: `${bal.value.toFixed(1)}%`, note: "IMF WEO, overall net lending/borrowing" },
    rev && { label: `Revenue / GDP ${year(rev.period)}`, value: `${rev.value.toFixed(1)}%`, note: "World Bank, excl. grants" },
    exp && { label: `Expense / GDP ${year(exp.period)}`, value: `${exp.value.toFixed(1)}%`, note: "World Bank" },
  ].filter(Boolean) as { label: string; value: string; note?: string }[];
  const debtRows = byYear({ imf_debt: (d.imf_debt || []).filter((p) => !p.is_projection) }, ["imf_debt"], 1990);
  const balRows = byYear({ imf_balance: (d.imf_balance || []).filter((p) => !p.is_projection) }, ["imf_balance"], 1990);
  const rxRows = byYear({ wb_revenue: d.wb_revenue || [], wb_expense: d.wb_expense || [] }, ["wb_revenue", "wb_expense"], 1990);
  const proj = (d.imf_debt || []).filter((p) => p.is_projection).slice(0, 3);

  return (
    <PageShell wide kicker={<Link to="/dashboards" className="hover:underline">Dashboards</Link>} title="Ghana budget and public debt"
      intro="How much Ghana's government owes, how much it borrows each year, and how revenue compares with spending, all as a share of GDP.">
      {isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : <KeyNumbersBox items={items} source="IMF World Economic Outlook and World Bank WDI" sourceHref="https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO/GHA" asOf={debt?.fetched_at} />}
      {debt && <ShareRow text={`Ghana's public debt was ${debt.value.toFixed(1)}% of GDP in ${year(debt.period)} (IMF)`} path="/dashboards/budget-and-debt" />}

      {debtRows.length > 1 && (
        <section className="py-4">
          <h2 className="kicker mb-2">Public debt, % of GDP</h2>
          <TimeChart yearly data={debtRows} unit="%" dp={1} series={[{ key: "imf_debt", name: "Gross debt", color: "#E3120B" }]} />
          <p className="font-ui text-[11px] text-[#5B5B5B]">Source: {src(debt)}. Recent years may be IMF estimates.{proj.length > 0 && ` IMF projections (not charted): ${proj.map((p) => `${year(p.period)} ${p.value.toFixed(1)}%`).join(", ")}.`}</p>
        </section>
      )}
      {balRows.length > 1 && (
        <section className="py-4">
          <h2 className="kicker mb-2">Budget balance, % of GDP</h2>
          <TimeChart yearly data={balRows} unit="%" dp={1} series={[{ key: "imf_balance", name: "Overall balance", color: "#1F5C99" }]} />
          <p className="font-ui text-[11px] text-[#5B5B5B]">Negative = deficit. Source: {src(bal)}.</p>
        </section>
      )}
      {rxRows.length > 1 && (
        <section className="py-4">
          <h2 className="kicker mb-2">Revenue vs expense, % of GDP</h2>
          <TimeChart yearly data={rxRows} unit="%" dp={1} series={[{ key: "wb_revenue", name: "Revenue (excl. grants)", color: "#2E8B57" }, { key: "wb_expense", name: "Expense", color: "#E3120B" }]} />
          <p className="font-ui text-[11px] text-[#5B5B5B]">Source: {src(rev)}, {src(exp)}. World Bank data for these series ends in {rev ? year(rev.period) : "—"}/{exp ? year(exp.period) : "—"}.</p>
        </section>
      )}
      <button className="font-ui text-[12px] underline text-[#E3120B]" onClick={() => downloadCsv("ghana-budget-debt.csv", [["series", "year", "value_pct_gdp", "projection", "source"],
        ...KEYS.flatMap((k) => (d[k] || []).map((p) => [k, year(p.period), p.value, p.is_projection ? "yes" : "", p.source_url]))])}>Download all as CSV</button>

      <section className="border-t border-[#D9D9D9] mt-6 py-4">
        <h2 className="kicker mb-2">Ministry of Finance documents</h2>
        <p className="font-serif text-[15px] text-[#5B5B5B]">Monthly fiscal data and debt bulletins from the Ministry of Finance are published as PDFs and are not yet loaded here. Read them at the source: <a className="underline" href="https://mofep.gov.gh/debt-operations" target="_blank" rel="noopener noreferrer">mofep.gov.gh/debt-operations</a> and <a className="underline" href="https://mofep.gov.gh/publications/fiscal-data" target="_blank" rel="noopener noreferrer">fiscal data</a>.</p>
      </section>
      <Methodology>
        <p>Debt and the overall balance come from the IMF World Economic Outlook database (GGXWDG_NGDP, GGXCNL_NGDP); revenue and expense from the World Bank (GC.REV.XGRT.GD.ZS, GC.XPN.TOTL.GD.ZS). All are read from the agencies' public APIs daily. Definitions differ from Ministry of Finance budget statements, so figures will not match the national budget exactly.</p>
        <p>IMF numbers for the current year and later are projections and are never charted as outturns.</p>
      </Methodology>
    </PageShell>
  );
};
export default BudgetDebt;
