export const revalidate = 600; // cached page: revalidate at most every 10 minutes
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { PageShell } from "@/components/vault/VaultBits";
import { StaticLineChart } from "@/components/StaticLineChart";
import { JsonLd } from "@/components/ssr/Prefetched";
import { getIndicator, loadIndicator, fmtVal, fmtDate, change } from "@/lib/indicators";
import { LICENCE } from "@/lib/dataVault";

type P = { params: Promise<{ slug: string }> };
// Rendered on first request and cached (ISR), like article pages; unknown slugs 404.
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const slug = (await params).slug;
  const s = await loadIndicator(slug);
  if (!s) return { title: "Indicator not found | StatsGH", robots: { index: false, follow: true } };
  const { ind, last, prev } = s;
  const title = last ? `${ind.name}: ${fmtVal(ind, last.value)} (${fmtDate(last.date, ind)})` : ind.name;
  const ch = change(ind, last, prev);
  const desc = last ? `${ind.short} was ${fmtVal(ind, last.value)} in the latest reading (${fmtDate(last.date, ind)})${ch ? `, ${ch} on the previous reading` : ""}. Source: ${ind.source}. ${ind.definition}` : ind.definition;
  return pageMeta(`/indicators/${ind.slug}`, title, desc.slice(0, 300));
}

export default async function IndicatorPage({ params }: P) {
  const slug = (await params).slug;
  if (!getIndicator(slug)) notFound();
  const s = (await loadIndicator(slug))!;
  const { ind, series, last, prev, yearAgo } = s;
  const url = `https://www.statsgh.com/indicators/${ind.slug}`;
  const f = (v: number) => fmtVal(ind, v);
  const chart = series.slice(-Math.min(series.length, ind.frequency === "Annual" ? 40 : ind.frequency === "Monthly" ? 60 : 260));
  const recent = [...series].reverse().slice(0, 12);
  const ld = {
    "@context": "https://schema.org", "@type": "Dataset", name: ind.name, description: `${ind.definition} Source: ${ind.source}.`, url,
    isAccessibleForFree: true, license: LICENCE.url,
    creator: { "@type": "Organization", name: ind.source, url: ind.sourceUrl },
    publisher: { "@type": "NewsMediaOrganization", "@id": "https://www.statsgh.com/#organization", name: "StatsGH", url: "https://www.statsgh.com" },
    spatialCoverage: { "@type": "Place", name: "Ghana" },
    ...(series.length ? { temporalCoverage: `${series[0].date}/${last!.date}`, dateModified: last!.date } : {}),
    ...(last ? { variableMeasured: { "@type": "PropertyValue", name: ind.short, value: last.value, unitText: ind.unit } } : {}),
    ...(ind.vault ? { distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `https://www.statsgh.com/api/data/${ind.vault}?format=csv` }] } : {}),
  };
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "StatsGH", item: "https://www.statsgh.com/" },
    { "@type": "ListItem", position: 2, name: "Indicators", item: "https://www.statsgh.com/indicators" },
    { "@type": "ListItem", position: 3, name: ind.name, item: url } ] };
  return (
    <PageShell>
      <JsonLd data={ld} />
      <JsonLd data={breadcrumb} />
      <p className="font-ui text-xs mb-2"><Link href="/indicators" className="text-[#E3120B]">← All indicators</Link></p>
      <h1 className="font-headline text-[30px] md:text-[34px] leading-tight text-[#121212]">{ind.name}</h1>
      {last ? (
        <p className="font-serif text-[20px] leading-[1.5] text-[#121212] mt-3" data-indicator-lead>
          <strong>{f(last.value)}</strong> in the latest reading ({fmtDate(last.date, ind)}). Source: {ind.source}.
        </p>
      ) : <p className="font-serif text-[18px] text-[#5B5B5B] mt-3">No figure is stored yet for this indicator.</p>}
      <p className="font-serif text-[17px] leading-[1.6] text-[#5B5B5B] mt-2 max-w-[760px]">{ind.definition}</p>

      {last && (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6 border-t-4 border-[#E3120B] bg-[#F6F6F6] p-4">
          <div><dt className="font-ui text-[11px] uppercase tracking-wide text-[#5B5B5B]">Previous reading</dt><dd className="font-serif text-xl font-bold">{prev ? f(prev.value) : "—"}</dd><dd className="font-ui text-[11px] text-[#5B5B5B]">{prev ? `${fmtDate(prev.date, ind)} · change ${change(ind, last, prev)}` : "None stored"}</dd></div>
          <div><dt className="font-ui text-[11px] uppercase tracking-wide text-[#5B5B5B]">A year earlier</dt><dd className="font-serif text-xl font-bold">{yearAgo ? f(yearAgo.value) : "—"}</dd><dd className="font-ui text-[11px] text-[#5B5B5B]">{yearAgo ? `${fmtDate(yearAgo.date, ind)} · change ${change(ind, last, yearAgo)}` : "Not stored"}</dd></div>
          <div><dt className="font-ui text-[11px] uppercase tracking-wide text-[#5B5B5B]">{ind.target ? "Target" : "Frequency"}</dt><dd className="font-serif text-xl font-bold">{ind.target ? `${ind.target.low}–${ind.target.high}%` : ind.frequency}</dd><dd className="font-ui text-[11px] text-[#5B5B5B]">{ind.target ? `${ind.target.label}; latest is ${last.value < ind.target.low ? "below" : last.value > ind.target.high ? "above" : "within"} the band` : ind.nextRelease}</dd></div>
        </dl>
      )}

      <StaticLineChart points={chart} label={`${ind.name} (${ind.unit})`} fmt={f} />
      <p className="font-ui text-xs text-[#5B5B5B]">Source: <a className="underline" href={ind.sourceUrl} target="_blank" rel="noopener noreferrer">{ind.source}</a>{last ? ` · last updated ${fmtDate(last.date)}` : ""} · {ind.frequency}. {ind.nextRelease}</p>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="kicker mb-2">Latest readings</h2>
          <table className="w-full max-w-[520px] font-ui text-sm"><tbody>
            {recent.map((o) => <tr key={o.date} className="border-b border-[#EEE]"><td className="py-1">{fmtDate(o.date, ind)}</td><td className="text-right font-semibold">{f(o.value)}</td></tr>)}
          </tbody></table>
        </section>
      )}

      <section className="mt-8 font-ui text-sm space-y-2">
        <h2 className="kicker mb-2">Download, cite and explore</h2>
        {ind.vault && <p><Link className="underline text-[#E3120B]" href={`/data-vault/${ind.vault}`}>Full dataset in the Data Vault</Link> (CSV and JSON, {LICENCE.name}).</p>}
        <p>Cite as: StatsGH, “{ind.name}”, {url}, data from {ind.source}{last ? `, latest ${fmtDate(last.date, ind)}` : ""}.</p>
        <p>Related: {ind.related.map((r, i) => <span key={r.href}>{i ? " · " : ""}<Link className="underline text-[#E3120B]" href={r.href}>{r.label}</Link></span>)}</p>
        <p className="text-[#5B5B5B]">Figures are stored with the date the source attaches to them. StatsGH never fills gaps with estimates; projections are excluded.</p>
      </section>
    </PageShell>
  );
}
