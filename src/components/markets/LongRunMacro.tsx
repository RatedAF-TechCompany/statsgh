"use client";
import { useQuery } from "@tanstack/react-query";
import { TimeChart } from "@/components/markets/MarketBits";
import { downloadCsv } from "@/lib/bogRates";
import { byYear, fetchMacro, latestActual, year } from "@/lib/macro";

/** Long-run annual chart for a World Bank series with the IMF WEO series alongside (projections dashed-off via label). */
export const LongRunMacro = ({ title, wbKey, imfKey, unit = "%", from = 1980, csvName }: { title: string; wbKey: string; imfKey: string; unit?: string; from?: number; csvName: string }) => {
  const { data } = useQuery({ queryKey: ["macro", wbKey, imfKey], queryFn: () => fetchMacro([wbKey, imfKey]) });
  if (!data) return null;
  const wb = data[wbKey], imf = data[imfKey];
  if (!wb.length && !imf.length) return <p className="font-serif text-[17px] text-[#5B5B5B] py-4">{title}: data unavailable.</p>;
  const rows = byYear({ [wbKey]: wb, [imfKey]: imf.filter((p) => !p.is_projection) }, [wbKey, imfKey], from);
  const proj = imf.filter((p) => p.is_projection);
  const lw = latestActual(wb), li = latestActual(imf);
  return (
    <section className="py-4">
      <h2 className="kicker mb-2">{title}</h2>
      <TimeChart yearly data={rows} unit={unit} dp={1} series={[
        { key: wbKey, name: "World Bank", color: "#E3120B" },
        { key: imfKey, name: "IMF WEO", color: "#1F5C99" },
      ]} />
      <p className="font-ui text-[11px] text-[#5B5B5B]">
        {lw && <>World Bank: {lw.value.toFixed(1)}{unit} in {year(lw.period)} (<a className="underline" href={lw.source_url} target="_blank" rel="noopener noreferrer">{lw.source}</a>). </>}
        {li && <>IMF: {li.value.toFixed(1)}{unit} in {year(li.period)} (<a className="underline" href={li.source_url} target="_blank" rel="noopener noreferrer">{li.source}</a>; recent years may be IMF estimates). </>}
        {proj.length > 0 && <>IMF projections, not shown on the chart: {proj.slice(0, 3).map((p) => `${year(p.period)} ${p.value.toFixed(1)}${unit}`).join(", ")}. </>}
        <button className="underline text-[#E3120B]" onClick={() => downloadCsv(`${csvName}.csv`, [["year", "world_bank", "imf_weo", "imf_is_projection"],
          ...byYear({ [wbKey]: wb, [imfKey]: imf }, [wbKey, imfKey], 1900).map((r) => [year(r.date), r[wbKey] ?? "", r[imfKey] ?? "", imf.find((p) => p.period === r.date)?.is_projection ? "yes" : ""])])}>Download CSV</button>
      </p>
    </section>
  );
};
