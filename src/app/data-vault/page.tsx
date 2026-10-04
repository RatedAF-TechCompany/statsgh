export const dynamic = "force-dynamic"; // live data page: render per request
import Link from "next/link";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { DATASETS, datasetMeta, LICENCE } from "@/lib/dataVault";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";

export const metadata = pageMeta("/data-vault", "Data Vault: open Ghana datasets", "Download every dataset StatsGH stores — Bank of Ghana rates, T-bills, CPI, GDP, GSE prices, fiscal data, commodities — as CSV or JSON under CC BY 4.0.");

const day = (s: string | null) => (s ? new Date(s.length === 10 ? s + "T00:00:00Z" : s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export default async function DataVaultPage() {
  const sb = createReadOnlyServerClient();
  const metas = await Promise.all(DATASETS.map((d) => datasetMeta(sb, d).catch(() => ({ rows: 0, lastUpdated: null }))));
  const ld = {
    "@context": "https://schema.org", "@type": "DataCatalog", name: "StatsGH Data Vault", url: "https://www.statsgh.com/data-vault",
    publisher: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" }, license: LICENCE.url,
    dataset: DATASETS.map((d) => ({ "@type": "Dataset", name: d.title, url: `https://www.statsgh.com/data-vault/${d.slug}` })),
  };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="border-b border-[#E3120B] pb-3 mb-4"><h1 className="section-label text-base">Data Vault</h1></div>
      <p className="font-serif text-[18px] leading-[1.6] text-[#5B5B5B] max-w-[760px]">
        Every dataset StatsGH stores, free to download. Each one names its original source and the date it was last updated.
        StatsGH's compilation is licensed under <a className="text-[#E3120B] underline" href={LICENCE.url}>{LICENCE.name}</a> (credit &ldquo;StatsGH&rdquo;); the original publishers&rsquo; terms also apply.
      </p>
      <div className="my-4"><ShareBar url="https://www.statsgh.com/data-vault" title="StatsGH Data Vault: open Ghana datasets" /></div>
      <div className="overflow-x-auto">
        <table className="w-full font-ui text-sm border-collapse">
          <thead><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]">
            <th className="py-2 pr-3">Dataset</th><th className="py-2 pr-3">Source</th><th className="py-2 pr-3">Frequency</th><th className="py-2 pr-3">Last updated</th><th className="py-2 pr-3 text-right">Rows</th><th className="py-2">Download</th>
          </tr></thead>
          <tbody>
            {DATASETS.map((d, i) => (
              <tr key={d.slug} className="border-b border-[#EEE] align-top">
                <td className="py-3 pr-3"><Link href={`/data-vault/${d.slug}`} className="font-semibold text-[#121212] hover:text-[#E3120B]">{d.title}</Link><p className="text-xs text-[#5B5B5B] mt-1 max-w-[380px]">{d.description}</p></td>
                <td className="py-3 pr-3 text-[#5B5B5B]">{d.source}</td>
                <td className="py-3 pr-3 text-[#5B5B5B]">{d.frequency}</td>
                <td className="py-3 pr-3 whitespace-nowrap">{day(metas[i].lastUpdated)}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{metas[i].rows.toLocaleString("en-GB")}</td>
                <td className="py-3 whitespace-nowrap"><a className="text-[#E3120B] underline" href={`/api/data/${d.slug}?format=csv`}>CSV</a> · <a className="text-[#E3120B] underline" href={`/api/data/${d.slug}`}>JSON</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-ui text-xs text-[#5B5B5B] mt-4">API: <code>GET https://www.statsgh.com/api/data/&lt;dataset&gt;</code> (JSON, add <code>?format=csv</code> for CSV). Read-only, cached for 5 minutes, limited to 60 requests a minute.</p>
    </PageShell>
  );
}
