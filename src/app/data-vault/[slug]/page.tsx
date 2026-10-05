export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { citation, datasetRows, getDataset, LICENCE } from "@/lib/dataVault";
import { CiteBox, MiniChart, PageShell, ShareBar } from "@/components/vault/VaultBits";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const d = getDataset((await params).slug);
  if (!d) return { title: "Dataset not found | StatsGH", robots: { index: false } };
  return pageMeta(`/data-vault/${d.slug}`, `${d.title} — dataset`, d.description.slice(0, 158));
}

const fmt = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v));

export default async function DatasetPage({ params }: P) {
  const d = getDataset((await params).slug);
  if (!d) notFound();
  const rows = await datasetRows(createReadOnlyServerClient(), d).catch(() => null);
  const last = rows?.length ? (rows[rows.length - 1][d.dateCol] as string) : null;
  const chart = d.chart && rows
    ? rows.filter((r) => Object.entries(d.chart!.where || {}).every(([k, v]) => r[k] === v) && r[d.chart!.y] != null)
        .map((r) => ({ x: String(r[d.dateCol]), y: Number(r[d.chart!.y]) }))
    : [];
  const url = `https://www.statsgh.com/data-vault/${d.slug}`;
  const ld = {
    "@context": "https://schema.org", "@type": "Dataset", name: d.title, description: d.description, url,
    license: LICENCE.url, isAccessibleForFree: true, dateModified: last || undefined,
    creator: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" },
    isBasedOn: d.sourceUrl, spatialCoverage: { "@type": "Place", name: "Ghana" },
    distribution: [
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `https://www.statsgh.com/api/data/${d.slug}?format=csv` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `https://www.statsgh.com/api/data/${d.slug}` },
    ],
  };
  const preview = (rows || []).slice(-15).reverse();
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <p className="font-ui text-xs mb-2"><Link href="/data-vault" className="text-[#E3120B]">← Data Vault</Link></p>
      <h1 className="font-headline text-[30px] leading-tight text-[#121212]">{d.title}</h1>
      <p className="font-serif text-[17px] leading-[1.6] text-[#5B5B5B] mt-2 max-w-[760px]">{d.description}</p>
      <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 my-5 font-ui text-sm">
        {[
          ["Source", <a key="s" href={d.sourceUrl} className="text-[#E3120B] underline" target="_blank" rel="noopener noreferrer">{d.source}</a>],
          ["Updated", d.frequency],
          ["Last observation", last ? String(last).slice(0, 10) : "—"],
          ["Rows", rows ? rows.length.toLocaleString("en-GB") : "unavailable"],
          ["Licence", <a key="l" href={LICENCE.url} className="underline">{LICENCE.name}, credit StatsGH</a>],
        ].map(([k, v]) => (<div key={String(k)} className="border-t border-[#D9D9D9] pt-2"><dt className="text-xs text-[#5B5B5B]">{k}</dt><dd className="mt-0.5">{v}</dd></div>))}
      </dl>
      {rows === null ? (
        <p className="font-ui text-sm border border-[#D9D9D9] p-4">Data unavailable right now. Please try again later.</p>
      ) : (
        <>
          {d.chart && <div className="mb-5"><MiniChart data={chart} label={`${d.chart.label} — ${d.source}`} /></div>}
          <div className="flex flex-wrap gap-4 items-center mb-5 font-ui text-sm">
            <a className="bg-[#E3120B] text-white px-3 py-1.5 font-semibold" href={`/api/data/${d.slug}?format=csv`}>Download CSV</a>
            <a className="border border-[#121212] px-3 py-1.5 font-semibold" href={`/api/data/${d.slug}`}>JSON</a>
            <ShareBar url={url} title={`${d.title} — StatsGH Data Vault`} />
          </div>
          <h2 className="kicker mb-2">Latest rows</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full font-ui text-xs border-collapse">
              <thead><tr className="border-b border-[#D9D9D9] text-left text-[#5B5B5B]">{d.columns.map((c) => <th key={c} className="py-1.5 pr-3 whitespace-nowrap">{c}</th>)}</tr></thead>
              <tbody>{preview.map((r, i) => <tr key={i} className="border-b border-[#EEE]">{d.columns.map((c) => <td key={c} className="py-1.5 pr-3 whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis">{fmt(r[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      <CiteBox text={citation(d, last)} />
    </PageShell>
  );
}
