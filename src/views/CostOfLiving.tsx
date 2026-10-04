"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { fetchFx, fetchPump } from "@/views/FuelCediTracker";
import { fetchReadings } from "@/views/InflationTracker";

const ghs = (n: number) => `GHS ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const dayLabel = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const num = (s: string) => { const v = parseFloat(s); return isFinite(v) && v >= 0 ? Math.min(v, 1e7) : 0; };

/** Latest point dated on or before the end of the given month (YYYY-MM). */
function atMonth<T extends { date: string }>(pts: T[], month: string): T | undefined {
  const end = `${month}-31`;
  return [...pts].filter((p) => p.date <= end).pop();
}

const Unavailable = ({ what }: { what: string }) => (
  <p className="text-sm text-[#5B5B5B]">Data unavailable — no stored {what} figure yet.</p>
);

const CostOfLiving = () => {
  const pump = useQuery({ queryKey: ["fct-pump"], queryFn: fetchPump });
  const usd = useQuery({ queryKey: ["fct-fx", "USD"], queryFn: () => fetchFx("USD") });
  const infl = useQuery({ queryKey: ["inflation-readings"], queryFn: fetchReadings });

  const [fuelType, setFuelType] = useState<"petrol" | "diesel">("petrol");
  const [litres, setLitres] = useState("40");
  const [food, setFood] = useState("1000");
  const [transport, setTransport] = useState("400");
  const [baseline, setBaseline] = useState("");

  const fuelPts = useMemo(() => [...(pump.data?.[fuelType] || [])].sort((a, b) => a.date.localeCompare(b.date)), [pump.data, fuelType]);
  const fx = usd.data || [];
  const readings = infl.data || [];
  const latestOf = (k: "headline" | "food") => [...readings].filter((r) => r.kind === k).pop();
  const headline = latestOf("headline");
  const foodR = latestOf("food") || headline;
  const foodIsFallback = !latestOf("food") && !!headline;

  // Baseline months available = months where we hold a fuel price or an FX rate.
  const months = useMemo(() => {
    const s = new Set<string>();
    [...fuelPts, ...fx].forEach((p) => s.add(p.date.slice(0, 7)));
    return [...s].sort().reverse().slice(1); // exclude the current month
  }, [fuelPts, fx]);

  const fuelNow = fuelPts[fuelPts.length - 1];
  const fuelBase = baseline ? atMonth(fuelPts, baseline) : undefined;
  const fxNow = fx[fx.length - 1];
  const fxBase = baseline ? atMonth(fx, baseline) : fx[0];

  const L = num(litres), F = num(food), T = num(transport);
  const fuelCost = fuelNow ? L * fuelNow.value : null;
  const fuelDelta = fuelNow && fuelBase ? L * (fuelNow.value - fuelBase.value) : null;
  const foodYearAgo = foodR ? F / (1 + foodR.value / 100) : null;
  const transYearAgo = headline ? T / (1 + headline.value / 100) : null;
  const fxChange = fxNow && fxBase && fxBase.date !== fxNow.date ? ((fxNow.value - fxBase.value) / fxBase.value) * 100 : null;

  const loading = pump.isLoading || usd.isLoading || infl.isLoading;
  const input = "w-full border border-[#D9D9D9] px-3 py-2 text-[15px] bg-white";

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="kicker mb-1">Tools</p>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#121212] mb-3">Cost of Living Calculator</h1>
        <p className="font-serif text-[17px] text-[#333] mb-6">
          Enter what you spend each month. We estimate the effect of the latest fuel price, cedi rate and inflation figures StatsGH has stored. Every figure is sourced; if one is missing we say so.
        </p>

        <section className="border-t border-[#D9D9D9] py-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm">Fuel type
            <select className={input} value={fuelType} onChange={(e) => setFuelType(e.target.value as any)}>
              <option value="petrol">Petrol</option><option value="diesel">Diesel</option>
            </select>
          </label>
          <label className="text-sm">Fuel per month (litres)
            <input className={input} inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} />
          </label>
          <label className="text-sm">Food basket per month (GHS)
            <input className={input} inputMode="decimal" value={food} onChange={(e) => setFood(e.target.value)} />
          </label>
          <label className="text-sm">Transport fares per month (GHS)
            <input className={input} inputMode="decimal" value={transport} onChange={(e) => setTransport(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">Compare with a baseline month (optional)
            <select className={input} value={baseline} onChange={(e) => setBaseline(e.target.value)}>
              <option value="">None — compare with a year ago where possible</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
        </section>

        {loading ? <p className="text-sm text-[#5B5B5B]">Loading latest figures…</p> : (
          <div className="space-y-0">
            <section className="border-t border-[#D9D9D9] py-5">
              <h2 className="kicker mb-2">Fuel</h2>
              {!fuelNow ? <Unavailable what={`${fuelType} pump price`} /> : (
                <>
                  <p className="font-serif text-2xl font-bold text-[#121212]">{ghs(fuelCost!)} <span className="text-sm font-normal text-[#5B5B5B]">a month at GHS {fuelNow.value.toFixed(2)}/litre</span></p>
                  {baseline && (fuelDelta !== null && fuelBase ? (
                    <p className="text-[15px] mt-1">{fuelDelta >= 0 ? "Up" : "Down"} {ghs(Math.abs(fuelDelta))} a month versus {monthLabel(baseline)} (GHS {fuelBase.value.toFixed(2)}/litre, {dayLabel(fuelBase.date)}).</p>
                  ) : <p className="text-sm text-[#5B5B5B] mt-1">Data unavailable — no stored {fuelType} price on or before {monthLabel(baseline)}.</p>)}
                  <p className="text-xs text-[#5B5B5B] mt-1">Source: pump price quoted in <a className="underline" href={`/${fuelNow.cat}/${fuelNow.slug}/`}>{fuelNow.title}</a> · {dayLabel(fuelNow.date)}. Figures quoted in articles, not an official price list.</p>
                </>
              )}
            </section>

            <section className="border-t border-[#D9D9D9] py-5">
              <h2 className="kicker mb-2">Food basket</h2>
              {!foodR ? <Unavailable what="food inflation" /> : (
                <>
                  <p className="text-[15px]">Food prices rose <strong>{foodR.value.toFixed(1)}%</strong> in the year to {monthLabel(foodR.period.slice(0, 7))}{foodIsFallback ? " (headline rate; no food figure stored)" : ""}. A basket costing {ghs(F)} now would have cost about <strong>{ghs(foodYearAgo!)}</strong> a year earlier — {ghs(F - foodYearAgo!)} more a month.</p>
                  <p className="text-xs text-[#5B5B5B] mt-1">Source: Ghana Statistical Service figure as reported in {foodR.article_slug ? <a className="underline" href={`/${foodR.category_slug}/${foodR.article_slug}/`}>{foodR.article_title}</a> : "StatsGH articles"}.</p>
                </>
              )}
            </section>

            <section className="border-t border-[#D9D9D9] py-5">
              <h2 className="kicker mb-2">Transport</h2>
              {!headline ? <Unavailable what="headline inflation" /> : (
                <>
                  <p className="text-[15px]">Using headline inflation of <strong>{headline.value.toFixed(1)}%</strong> ({monthLabel(headline.period.slice(0, 7))}), fares of {ghs(T)} now compare with about <strong>{ghs(transYearAgo!)}</strong> a year earlier. StatsGH holds no transport-specific price index, so this is a general estimate.</p>
                  <p className="text-xs text-[#5B5B5B] mt-1">Source: {headline.article_slug ? <a className="underline" href={`/${headline.category_slug}/${headline.article_slug}/`}>{headline.article_title}</a> : "StatsGH articles"}.</p>
                </>
              )}
            </section>

            <section className="border-t border-[#D9D9D9] py-5">
              <h2 className="kicker mb-2">The cedi</h2>
              {!fxNow ? <Unavailable what="exchange rate" /> : (
                <>
                  <p className="text-[15px]">GHS {fxNow.value.toFixed(2)} to the US dollar on {dayLabel(fxNow.date)}.
                    {fxChange !== null && fxBase ? <> Since {dayLabel(fxBase.date)} (GHS {fxBase.value.toFixed(2)}), the dollar costs <strong>{pct(fxChange)}</strong> in cedis — goods priced in dollars, such as imported food and fuel, move in that direction.</> : baseline ? <> No stored rate on or before {monthLabel(baseline)}.</> : null}
                  </p>
                  <p className="text-xs text-[#5B5B5B] mt-1">Source: open.er-api.com, stored hourly by StatsGH · tracking started {fx[0] ? dayLabel(fx[0].date) : "—"}.</p>
                </>
              )}
            </section>
          </div>
        )}

        <section className="border-t border-[#D9D9D9] py-6 bg-[#FAF7F2] px-4 mt-2">
          <h2 className="kicker mb-2">How this calculator works</h2>
          <ul className="text-sm text-[#333] list-disc pl-5 space-y-1">
            <li>Fuel: your litres × the latest pump price quoted in a published StatsGH article. With a baseline month, we use the last price stored on or before the end of that month.</li>
            <li>Food and transport: inflation rates are year-on-year, so we divide your spend by (1 + rate) to estimate the year-ago cost. Food uses the food CPI rate; transport uses headline CPI because no transport index is stored.</li>
            <li>The cedi line is shown for context and is not added to your totals, to avoid double-counting with inflation.</li>
            <li>These are estimates for an average household, not a forecast. Your own prices may differ. Nothing is made up: a missing figure is shown as unavailable.</li>
          </ul>
          <p className="text-sm mt-3">See the <a className="underline" href="/trackers/fuel-and-cedi">Fuel &amp; Cedi tracker</a>, the <a className="underline" href="/trackers/cpi">Inflation Explainer</a> and <a className="underline" href="/about">About &amp; Methodology</a>.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CostOfLiving;
