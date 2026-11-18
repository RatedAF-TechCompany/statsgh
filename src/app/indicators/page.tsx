export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import Link from "next/link";
import { pageMeta } from "@/lib/pageMeta";
import { PageShell } from "@/components/vault/VaultBits";
import { INDICATORS, loadIndicator, fmtVal, fmtDate, change } from "@/lib/indicators";
import { JsonLd } from "@/components/ssr/Prefetched";
import { LICENCE } from "@/lib/dataVault";

export const metadata = pageMeta("/indicators", "Ghana economic indicators: latest values and sources", "The latest official figure, date and source for Ghana's key indicators: inflation, the cedi, T-bill rates, the policy rate, the GSE, GDP growth, public debt, oil and gold.");

export default async function IndicatorsHub() {
  const snaps = await Promise.all(INDICATORS.map((i) => loadIndicator(i.slug)));
  const ld = { "@context": "https://schema.org", "@type": "DataCatalog", name: "StatsGH Ghana economic indicators", url: "https://www.statsgh.com/indicators",
    publisher: { "@type": "NewsMediaOrganization", "@id": "https://www.statsgh.com/#organization", name: "StatsGH" },
    dataset: INDICATORS.map((i) => ({ "@type": "Dataset", name: i.name, description: i.definition || i.name, url: `https://www.statsgh.com/indicators/${i.slug}`,
      creator: { "@type": "Organization", name: "StatsGH", url: "https://www.statsgh.com" }, license: LICENCE.url, isAccessibleForFree: true })) };
  return (
    <PageShell>
      <JsonLd data={ld} />
      <div className="border-b border-[#E3120B] pb-3 mb-4"><h1 className="section-label text-base">Ghana economic indicators</h1></div>
      <p className="font-serif text-[18px] leading-[1.6] text-[#5B5B5B] max-w-[760px] mb-4">The latest stored figure for each indicator, with its date and official source. Every number links to a page with its history, comparisons and downloads. Full datasets are in the <Link className="text-[#E3120B] underline" href="/data-vault">Data Vault</Link>.</p>
      <div className="overflow-x-auto">
        <table className="w-full font-ui text-sm border-collapse">
          <thead><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]"><th className="py-2 pr-3">Indicator</th><th className="pr-3 text-right">Latest</th><th className="pr-3">Date</th><th className="pr-3">Change</th><th>Source</th></tr></thead>
          <tbody>
            {snaps.map((s) => s && (
              <tr key={s.ind.slug} className="border-b border-[#EEE] align-top">
                <td className="py-2 pr-3"><Link href={`/indicators/${s.ind.slug}`} className="font-semibold text-[#121212] hover:text-[#E3120B] underline">{s.ind.name}</Link></td>
                <td className="pr-3 text-right font-semibold whitespace-nowrap">{s.last ? fmtVal(s.ind, s.last.value) : "Not yet stored"}</td>
                <td className="pr-3 whitespace-nowrap">{s.last ? fmtDate(s.last.date, s.ind) : "—"}</td>
                <td className="pr-3 whitespace-nowrap">{change(s.ind, s.last, s.prev) ?? "—"}</td>
                <td className="text-[#5B5B5B]"><a className="underline" href={s.ind.sourceUrl} target="_blank" rel="noopener noreferrer">{s.ind.source}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
