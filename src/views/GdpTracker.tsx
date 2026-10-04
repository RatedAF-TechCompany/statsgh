"use client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { KeyNumbersBox, Methodology, PageShell, ShareRow } from "@/components/markets/MarketBits";
import { LongRunMacro } from "@/components/markets/LongRunMacro";
import { fetchMacro, latestActual, year } from "@/lib/macro";

const GdpTracker = () => {
  const { data, isLoading } = useQuery({ queryKey: ["macro", "gdp-page"], queryFn: () => fetchMacro(["wb_gdp", "imf_gdp"]) });
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
      <p className="font-ui text-[12px] text-[#5B5B5B]">Quarterly GDP from the Ghana Statistical Service is not loaded yet; see the <Link to="/calendar" className="underline text-[#E3120B]">release calendar</Link> for the next QGDP date and the <a className="underline" href="https://statsghana.gov.gh" target="_blank" rel="noopener noreferrer">GSS website</a> for the release.</p>
      <Methodology>
        <p>Annual real GDP growth (constant prices) from the World Bank World Development Indicators (NY.GDP.MKTP.KD.ZG) and the IMF World Economic Outlook (NGDP_RPCH), both read from their public APIs daily. The two agencies can differ slightly because of revisions and methods.</p>
        <p>IMF figures for the current year and later are projections and are listed separately, never charted as outturns.</p>
      </Methodology>
    </PageShell>
  );
};
export default GdpTracker;
