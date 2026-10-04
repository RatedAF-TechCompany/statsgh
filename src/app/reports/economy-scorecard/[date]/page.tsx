export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";
import { chg, diff, fmtDate, scorecardSummary, type Obs } from "@/lib/reports";
import { BOG_URLS } from "@/lib/bogRates";
import { GSE_URL } from "@/lib/gse";

type P = { params: Promise<{ date: string }> };
const load = async (date: string) =>
  (await createReadOnlyServerClient().from("reports").select("*").eq("kind", "economy-scorecard").eq("edition", date).maybeSingle()).data;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { date } = await params;
  const r = await load(date);
  if (!r) return { title: "Scorecard not found | StatsGH", robots: { index: false } };
  const m = pageMeta(`/reports/economy-scorecard/${date}`, `Ghana Economy Scorecard, week ending ${fmtDate(date)}`, scorecardSummary(r.data).slice(0, 2).join(" ").slice(0, 158));
  const img = `https://www.statsgh.com/og/report/economy-scorecard/${date}`;
  return { ...m, openGraph: { ...m.openGraph, images: [{ url: img, width: 1200, height: 630 }] }, twitter: { ...m.twitter, images: [img] } };
}

function Arrow({ v, invert = false, unit = "%" }: { v: number | null; invert?: boolean; unit?: string }) {
  if (v == null) return <span className="text-[#9B9B9B]">—</span>;
  const up = v > 0;
  const good = invert ? !up : up;
  const cls = Math.abs(v) < 1e-9 ? "text-[#5B5B5B]" : good ? "text-[#2E7D32]" : "text-[#E3120B]";
  return <span className={cls}>{Math.abs(v) < 1e-9 ? "→" : up ? "▲" : "▼"} {up ? "+" : ""}{v.toFixed(2)}{unit}</span>;
}

type Row = { label: string; now: Obs; w: number | null; m: number | null; y: number | null; fmt: (n: number) => string; src: string; href: string; invert?: boolean; unit?: string; note?: string };

export default async function ScorecardPage({ params }: P) {
  const { date } = await params;
  const r = await load(date);
  if (!r) notFound();
  const d: any = r.data;
  const { data: neighbours } = await createReadOnlyServerClient().from("reports").select("edition").eq("kind", "economy-scorecard").order("edition");
  const eds = (neighbours || []).map((n) => n.edition);
  const i = eds.indexOf(date);
  const tb = (k: string): Row => ({ label: `${k}-day T-bill rate`, now: d.tbills?.[k]?.now, w: diff(d.tbills?.[k]?.now, d.tbills?.[k]?.week), m: diff(d.tbills?.[k]?.now, d.tbills?.[k]?.month), y: diff(d.tbills?.[k]?.now, d.tbills?.[k]?.year), fmt: (n) => `${n.toFixed(2)}%`, src: "Bank of Ghana", href: BOG_URLS.tbills, unit: " pts", invert: true });
  const rows: Row[] = [
    { label: "Cedi per US dollar (higher = weaker cedi)", now: d.usd?.now, w: chg(d.usd?.now, d.usd?.week), m: chg(d.usd?.now, d.usd?.month), y: chg(d.usd?.now, d.usd?.year), fmt: (n) => `GH₵${n.toFixed(4)}`, src: "Bank of Ghana", href: BOG_URLS.fx, invert: true },
    { label: "Cedi per pound", now: d.gbp?.now, w: chg(d.gbp?.now, d.gbp?.week), m: null, y: null, fmt: (n) => `GH₵${n.toFixed(4)}`, src: "Bank of Ghana", href: BOG_URLS.fx, invert: true },
    { label: "Cedi per euro", now: d.eur?.now, w: chg(d.eur?.now, d.eur?.week), m: null, y: null, fmt: (n) => `GH₵${n.toFixed(4)}`, src: "Bank of Ghana", href: BOG_URLS.fx, invert: true },
    tb("91"), tb("182"), tb("364"),
    { label: "Policy rate", now: d.policy, w: null, m: null, y: null, fmt: (n) => `${n.toFixed(1)}%`, src: "Bank of Ghana", href: BOG_URLS.policy, note: d.policy?.prev ? `previous ${d.policy.prev.value}%` : undefined },
    { label: "Headline inflation", now: d.inflation ? { value: d.inflation.value, date: d.inflation.period } : null, w: null, m: diff(d.inflation, d.inflation?.prev), y: diff(d.inflation, d.inflation?.year), fmt: (n) => `${n}%`, src: "GSS via StatsGH article", href: d.inflation ? `/${d.inflation.category_slug}/${d.inflation.article_slug}` : "/trackers/cpi", unit: " pts", invert: true, note: "monthly reading" },
    { label: "GSE Composite Index", now: d.gse?.now, w: chg(d.gse?.now, d.gse?.week), m: chg(d.gse?.now, d.gse?.month), y: chg(d.gse?.now, d.gse?.year), fmt: (n) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 }), src: "Ghana Stock Exchange (end-of-day)", href: GSE_URL },
  ];
  const c = d.commodities || {};
  const COMM: Record<string, string> = { oil_brent: "Brent crude (US$/barrel)", oil_wti: "WTI crude (US$/barrel)", cocoa: "Cocoa (US$/tonne, IMF)" };
  Object.keys(COMM).forEach((k) => c[k] && rows.push({ label: COMM[k], now: c[k], w: chg(c[k], c[k].week), m: null, y: null, fmt: (n) => `$${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`, src: c[k].source, href: "https://fred.stlouisfed.org/", note: "international price" }));
  if (d.gold) rows.push({ label: "Gold, international spot (US$/oz)", now: d.gold, w: chg(d.gold, d.gold.prev), m: null, y: null, fmt: (n) => `$${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`, src: d.gold.source, href: d.gold.source_url, note: "not the Ghana Gold Board price" });
  const shown = rows.filter((x) => x.now);
  const summary = scorecardSummary(d);
  const url = `https://www.statsgh.com/reports/economy-scorecard/${date}`;
  const ld = { "@context": "https://schema.org", "@type": "Report", name: `Ghana Economy Scorecard — week ending ${fmtDate(date)}`, url, datePublished: r.compiled_at, dateModified: r.compiled_at, author: { "@type": "Organization", name: "StatsGH Data Desk", url: "https://www.statsgh.com/authors/data-desk" }, publisher: { "@type": "NewsMediaOrganization", name: "StatsGH", url: "https://www.statsgh.com" } };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <p className="font-ui text-xs mb-2"><Link href="/reports" className="text-[#E3120B]">← Reports</Link></p>
      <p className="kicker">Ghana Economy Scorecard</p>
      <h1 className="font-headline text-[32px] leading-tight text-[#121212]">Week ending {fmtDate(date)}</h1>
      <p className="font-ui text-xs text-[#5B5B5B] mt-1">By <Link href="/authors/data-desk" className="underline">StatsGH Data Desk</Link> · compiled automatically from stored data on {fmtDate(r.compiled_at)}</p>
      <div className="my-4"><ShareBar url={url} title={`Ghana Economy Scorecard, week ending ${fmtDate(date)}`} /></div>
      {summary.length > 0 && <div className="bg-[#FAF7F2] border-l-4 border-[#E3120B] p-4 mb-6 font-serif text-[17px] leading-[1.7] space-y-2">{summary.map((s) => <p key={s}>{s}</p>)}</div>}
      <div className="overflow-x-auto">
        <table className="w-full font-ui text-sm border-collapse">
          <thead><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]"><th className="py-2 pr-3">Measure</th><th className="py-2 pr-3 text-right">Latest</th><th className="py-2 pr-3">As of</th><th className="py-2 pr-3 text-right">vs week</th><th className="py-2 pr-3 text-right">vs month</th><th className="py-2 pr-3 text-right">vs year</th><th className="py-2">Source</th></tr></thead>
          <tbody>{shown.map((x) => (
            <tr key={x.label} className="border-b border-[#EEE]">
              <td className="py-2 pr-3">{x.label}{x.note && <span className="block text-[11px] text-[#5B5B5B]">{x.note}</span>}</td>
              <td className="py-2 pr-3 text-right tabular-nums font-semibold">{x.fmt(Number(x.now!.value))}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(x.now!.date || x.now!.period)}</td>
              <td className="py-2 pr-3 text-right tabular-nums"><Arrow v={x.w} invert={x.invert} unit={x.unit} /></td>
              <td className="py-2 pr-3 text-right tabular-nums"><Arrow v={x.m} invert={x.invert} unit={x.unit} /></td>
              <td className="py-2 pr-3 text-right tabular-nums"><Arrow v={x.y} invert={x.invert} unit={x.unit} /></td>
              <td className="py-2"><a href={x.href} className="text-[#E3120B] underline">{x.src}</a></td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="font-ui text-[11px] text-[#5B5B5B] mt-2">Green/red shows direction for the cedi and markets (a rising GH₵ per dollar is shown red). Rate changes are in percentage points. A dash means no stored comparison point exists. GSE figures are end-of-day, not real-time.</p>
      {d.movers && (d.movers.up?.length > 0 || d.movers.down?.length > 0) && (
        <section className="mt-8 grid md:grid-cols-2 gap-6">
          {(["up", "down"] as const).map((k) => (
            <div key={k}>
              <h2 className="kicker mb-2">{k === "up" ? "Top GSE gainers" : "Top GSE losers"} ({fmtDate(d.movers.from)} → {fmtDate(d.movers.to)})</h2>
              <ul className="font-ui text-sm divide-y divide-[#EEE]">{(d.movers[k] || []).map((m: any) => (
                <li key={m.symbol} className="py-1.5 flex justify-between"><Link href={`/markets/gse/${m.symbol}`} className="hover:text-[#E3120B]">{m.name} <span className="text-[#5B5B5B]">({m.symbol})</span></Link><span className={m.pct > 0 ? "text-[#2E7D32]" : "text-[#E3120B]"}>{m.pct > 0 ? "+" : ""}{m.pct}% · GH₵{Number(m.close).toFixed(2)}</span></li>))}</ul>
            </div>))}
        </section>
      )}
      <nav className="flex justify-between font-ui text-sm mt-10 border-t border-[#D9D9D9] pt-3">
        {i > 0 ? <Link className="text-[#E3120B]" href={`/reports/economy-scorecard/${eds[i - 1]}`}>← Week ending {fmtDate(eds[i - 1])}</Link> : <span />}
        {i >= 0 && i < eds.length - 1 ? <Link className="text-[#E3120B]" href={`/reports/economy-scorecard/${eds[i + 1]}`}>Week ending {fmtDate(eds[i + 1])} →</Link> : <span />}
      </nav>
    </PageShell>
  );
}
