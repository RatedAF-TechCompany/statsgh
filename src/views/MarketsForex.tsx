"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BOG_SOURCE, BOG_URLS, downloadCsv, fetchBogFx, fmtDay, latestFx } from "@/lib/bogRates";
import { KeyNumbersBox, Methodology, PageShell, ShareRow, TimeChart } from "@/components/markets/MarketBits";
import { supabase } from "@/integrations/supabase/client";

const PAIRS = [
  { pair: "USDGHS", label: "US dollar", short: "USD/GHS", color: "#E3120B" },
  { pair: "GBPGHS", label: "Pound sterling", short: "GBP/GHS", color: "#1F5C99" },
  { pair: "EURGHS", label: "Euro", short: "EUR/GHS", color: "#2E8B57" },
];

/** Market mid-rate fallback, shown only if no official BoG figure is stored. */
async function fetchFallback() {
  const { data } = await supabase.from("currency_rates").select("base_currency, rate, fetched_at")
    .eq("target_currency", "GHS").eq("source", "open.er-api.com").in("base_currency", ["USD", "GBP", "EUR"])
    .order("fetched_at", { ascending: false }).limit(3);
  return data || [];
}

const MarketsForex = () => {
  const [range, setRange] = useState<30 | 90>(30);
  const fx = useQuery({ queryKey: ["bog-fx", 120], queryFn: () => fetchBogFx(120) });
  const rows = fx.data;
  const fb = useQuery({ queryKey: ["fx-fallback"], queryFn: fetchFallback, enabled: !!rows && rows.length === 0 });

  const latest = useMemo(() => PAIRS.map((p) => ({ ...p, l: rows ? latestFx(rows, p.pair) : null })), [rows]);
  const asOf = latest.map((x) => x.l?.date).filter(Boolean).sort().pop() as string | undefined;

  const chart = useMemo(() => {
    if (!rows?.length) return [];
    const cutoff = new Date(Date.now() - range * 864e5).toISOString().slice(0, 10);
    const m = new Map<string, Record<string, any>>();
    rows.filter((r) => r.rate_date >= cutoff).forEach((r) => {
      const o = m.get(r.rate_date) || { date: r.rate_date };
      o[r.pair] = r.mid;
      m.set(r.rate_date, o);
    });
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, range]);

  const table = useMemo(() => (rows || []).slice().sort((a, b) => b.rate_date.localeCompare(a.rate_date) || a.pair.localeCompare(b.pair)), [rows]);
  const first = rows?.[0]?.rate_date;

  const keyItems = latest.filter((x) => x.l).map((x) => {
    const ch = x.l!.prev != null ? ((x.l!.value - x.l!.prev) / x.l!.prev) * 100 : null;
    return { label: x.short, value: x.l!.value.toFixed(4), note: ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}% vs previous day` : "No previous day stored" };
  });
  const usd = latest[0].l;

  return (
    <PageShell
      wide
      kicker={<><Link to="/markets-data" className="hover:underline">Markets &amp; Data</Link> · Markets</>}
      title="Cedi exchange rates (Bank of Ghana)"
      intro="Official Bank of Ghana interbank mid-rates for the cedi against the dollar, pound and euro, published each business day."
    >
      <nav className="font-ui text-[12px] flex gap-4 mb-2">
        <span className="font-bold">Forex</span>
        <Link to="/markets/rates" className="underline text-[#E3120B]">Interest rates</Link>
        <Link to="/trackers/fuel-and-cedi" className="underline text-[#E3120B]">Fuel &amp; Cedi</Link>
      </nav>

      {fx.isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : (
        <KeyNumbersBox items={keyItems} source={`${BOG_SOURCE} — daily interbank FX rates`} sourceHref={BOG_URLS.fx} asOf={asOf} />
      )}

      {rows && rows.length === 0 && (fb.data?.length ? (
        <section className="border border-[#D9D9D9] p-4 my-4">
          <h2 className="kicker mb-2">Market mid-rate (not official)</h2>
          <p className="text-sm text-[#5B5B5B] mb-2">Official Bank of Ghana figures are unavailable right now. These are open-market mid-rates from open.er-api.com.</p>
          <ul className="text-sm">{fb.data.map((r: any) => <li key={r.base_currency}>{r.base_currency}/GHS {Number(r.rate).toFixed(4)} · as of {fmtDay(r.fetched_at)}</li>)}</ul>
        </section>
      ) : null)}

      {usd && <ShareRow text={`Bank of Ghana: US$1 = GH₵${usd.value.toFixed(4)} (as of ${fmtDay(usd.date)})`} path="/markets/forex" />}

      {chart.length > 1 && (
        <section className="border-t border-[#D9D9D9] py-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="kicker">Cedi per unit of foreign currency</h2>
            <div className="font-ui text-[12px] flex gap-2">
              {[30, 90].map((d) => (
                <button key={d} onClick={() => setRange(d as 30 | 90)} className={`px-2 py-0.5 border ${range === d ? "bg-[#121212] text-white border-[#121212]" : "border-[#D9D9D9]"}`}>{d} days</button>
              ))}
            </div>
          </div>
          <TimeChart data={chart} series={PAIRS.map((p) => ({ key: p.pair, name: p.short, color: p.color }))} unit="GHS" dp={4} />
          <p className="text-xs text-[#5B5B5B] mt-1">Stored history starts {first ? fmtDay(first) : "—"} · Source: <a className="underline" href={BOG_URLS.fx} target="_blank" rel="noopener noreferrer">{BOG_SOURCE}</a></p>
        </section>
      )}

      {table.length > 0 && (
        <section className="border-t border-[#D9D9D9] py-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="kicker">Daily rates</h2>
            <button
              className="font-ui text-[12px] underline text-[#E3120B]"
              onClick={() => downloadCsv("statsgh-bog-fx-rates.csv", ["date", "pair", "buying", "selling", "mid", "source_url"], table.map((r) => [r.rate_date, r.pair, r.buying, r.selling, r.mid, r.source_url]))}
            >Download CSV</button>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full font-ui text-[13px]">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]"><th className="py-1">Date</th><th>Pair</th><th className="text-right">Buying</th><th className="text-right">Selling</th><th className="text-right">Mid</th></tr></thead>
              <tbody>
                {table.slice(0, 180).map((r) => (
                  <tr key={r.rate_date + r.pair} className="border-b border-[#EEE]"><td className="py-1">{fmtDay(r.rate_date)}</td><td>{r.pair.slice(0, 3)}/GHS</td><td className="text-right">{r.buying?.toFixed(4) ?? "—"}</td><td className="text-right">{r.selling?.toFixed(4) ?? "—"}</td><td className="text-right font-semibold">{r.mid.toFixed(4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Methodology>
        <p>Figures are read from the Bank of Ghana's daily interbank FX rates page twice each business day and stored with the date the Bank attaches to them. Past months come from the Bank's historical interbank rates table.</p>
        <p>The mid-rate is the midpoint of the Bank's buying and selling rates. Retail forex bureau and bank counter rates are usually different. If a fetch fails, the page keeps the last good figure and shows its date. It never fills in estimates. The open.er-api.com market mid-rate appears only when no official figure is stored, and it is labelled as such.</p>
      </Methodology>
    </PageShell>
  );
};
export default MarketsForex;
