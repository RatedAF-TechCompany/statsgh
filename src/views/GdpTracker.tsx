"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { KeyNumbersBox, Methodology, PageShell, ShareRow } from "@/components/markets/MarketBits";
import { LongRunMacro } from "@/components/markets/LongRunMacro";
import { fetchMacro, latestActual, year, GSS_QGDP_KEY, quarterLabel } from "@/lib/macro";
import { downloadCsv } from "@/lib/bogRates";

const GdpTracker = () => {
  const { data, isLoading } = useQuery({ queryKey: ["macro", "gdp-page"], queryFn: () => fetchMacro(["wb_gdp", "imf_gdp"]) });
  const qq = useQuery({ queryKey: ["macro", GSS_QGDP_KEY], queryFn: () => fetchMacro([GSS_QGDP_KEY]) });
  const quarters = qq.data?.[GSS_QGDP_KEY] || [];
  const lq = quarters[quarters.length - 1];
  const wb = data?.wb_gdp || [];
  const lw = latestActual(wb);
  const prev = lw ? wb[wb.indexOf(lw) - 1] : undefined;
  const imfNext = (data?.imf_gdp || []).find((p) => p.is_projection);
  const avg10 = wb.slice(-10);
  const items = [
    lw && { label: `Real GDP growth ${year(lw.period)}`, value: `${lw.value.toFixed(1)}%`, note: prev ? `${prev.value.toFixed(1)}% in ${year(prev.period)}` : undefined },
    avg10.length === 10 && { label: `10-year average`, value: `${(avg10.reduce((s, p) => s + p.value, 0) / 10).toFixed(1)}%`, note: `${year(avg10[0].period)}–${year(avg10[9].period)}` },
    imfNext && { label: `IMF projection ${year(imfNext.period)}`, value: `${imfNext.value.toFixed(1)}%`, note: "Projection, not an outturn" },
  ].filter(Boolean) as { label: string; value: string; note?: string }[];
  return (
    <PageShell wide kicker={<><Link to="/dashboards" className="hover:underline">Dashboards</Link> · Trackers</>} title="Ghana GDP growth"
      intro="How fast Ghana's economy grows each year, after inflation: annual real GDP growth from the World Bank and the IMF.">
      {isLoading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : <KeyNumbersBox items={items} source={lw?.source || "World Bank"} sourceHref={lw?.source_url || "https://data.worldbank.org"} asOf={lw?.fetched_at} />}
      {lw && <ShareRow text={`Ghana's real GDP grew ${lw.value.toFixed(1)}% in ${year(lw.period)} (World Bank)`} path="/trackers/gdp" />}
      <LongRunMacro title="Real GDP growth, % per year" wbKey="wb_gdp" imfKey="imf_gdp" csvName="ghana-gdp-growth" from={1961} />
      {quarters.length > 0 ? (
        <section className="py-4">
          <h2 className="kicker mb-2">Quarterly real GDP growth (Ghana Statistical Service)</h2>
          <p className="font-serif text-[17px] text-[#121212] mb-2">Real GDP grew <strong>{lq.value.toFixed(1)}%</strong> year on year in {quarterLabel(lq.period)}, according to the Ghana Statistical Service.</p>
          <table className="w-full text-sm max-w-md">
            <thead><tr className="border-b border-[#121212] text-left font-ui text-[12px]"><th className="py-2">Quarter</th><th className="text-right">Growth, % y/y</th></tr></thead>
            <tbody>{quarters.slice(-8).reverse().map((p) => (
              <tr key={p.period} className="border-b border-[#EFEFEF]"><td className="py-1.5">{quarterLabel(p.period)}</td><td className="text-right">{p.value.toFixed(1)}%</td></tr>
            ))}</tbody>
          </table>
          <p className="font-ui text-[11px] text-[#5B5B5B] mt-2">
            Source: <a className="underline" href={lq.source_url} target="_blank" rel="noopener noreferrer">{lq.source}</a>. {quarters.length} quarters from {quarterLabel(quarters[0].period)}. GSS revises recent quarters; the latest is provisional.{" "}
            <button className="underline text-[#E3120B]" onClick={() => downloadCsv("ghana-quarterly-gdp-growth-gss.csv", [["quarter", "real_gdp_growth_yoy_pct", "source"], ...quarters.map((p) => [quarterLabel(p.period), p.value, p.source_url])])}>Download CSV</button>
          </p>
        </section>
      ) : (
        <p className="font-ui text-[12px] text-[#5B5B5B]">Quarterly GDP from the Ghana Statistical Service is not loaded yet; see the <Link to="/calendar" className="underline text-[#E3120B]">release calendar</Link> for the next QGDP date and the <a className="underline" href="https://statsghana.gov.gh" target="_blank" rel="noopener noreferrer">GSS website</a> for the release.</p>
      )}
      <Methodology>
        <p>Annual real GDP growth (constant prices) from the World Bank World Development Indicators (NY.GDP.MKTP.KD.ZG) and the IMF World Economic Outlook (NGDP_RPCH), both read from their public APIs daily. The two agencies can differ slightly because of revisions and methods.</p>
        <p>Quarterly growth is the Ghana Statistical Service's real GDP growth rate, year on year (each quarter against the same quarter a year earlier), at constant prices, as shown on the GSS website.</p>
        <p>IMF figures for the current year and later are projections and are listed separately, never charted as outturns.</p>
      </Methodology>
    </PageShell>
  );
};
export default GdpTracker;
