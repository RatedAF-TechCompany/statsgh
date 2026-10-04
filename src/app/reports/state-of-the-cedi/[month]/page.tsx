export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { MiniChart, PageShell, ShareBar } from "@/components/vault/VaultBits";
import { chg, fmtDate, monthLabel } from "@/lib/reports";

type P = { params: Promise<{ month: string }> };
const load = async (m: string) =>
  (await createReadOnlyServerClient().from("reports").select("*").eq("kind", "state-of-the-cedi").eq("edition", m).maybeSingle()).data;
const NAMES: Record<string, string> = { USDGHS: "US dollar", GBPGHS: "Pound sterling", EURGHS: "Euro" };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { month } = await params;
  const r = await load(month);
  if (!r) return { title: "Report not found | StatsGH", robots: { index: false } };
  const m = pageMeta(`/reports/state-of-the-cedi/${month}`, `State of the Cedi: ${monthLabel(month)}`, `How the cedi moved against the dollar, pound and euro in ${monthLabel(month)}: start, end, high and low from official Bank of Ghana rates.`);
  const img = `https://www.statsgh.com/og/report/state-of-the-cedi/${month}`;
  return { ...m, openGraph: { ...m.openGraph, images: [{ url: img, width: 1200, height: 630 }] }, twitter: { ...m.twitter, images: [img] } };
}

export default async function CediReportPage({ params }: P) {
  const { month } = await params;
  const r = await load(month);
  if (!r) notFound();
  const d: any = r.data;
  const usd = d.pairs.USDGHS;
  const mChg = chg(usd.end, usd.start);
  const sentence = mChg == null ? null
    : `In ${monthLabel(month)}${d.complete ? "" : " (to date)"}, the cedi ${Math.abs(mChg) < 0.05 ? "was broadly flat" : mChg > 0 ? `weakened ${mChg.toFixed(2)}%` : `strengthened ${Math.abs(mChg).toFixed(2)}%`} against the US dollar, from GH₵${Number(usd.start.value).toFixed(4)} on ${fmtDate(usd.start.date)} to GH₵${Number(usd.end.value).toFixed(4)} on ${fmtDate(usd.end.date)}. Its weakest point was GH₵${Number(usd.high.value).toFixed(4)} (${fmtDate(usd.high.date)}) and its strongest GH₵${Number(usd.low.value).toFixed(4)} (${fmtDate(usd.low.date)}).`;
  const url = `https://www.statsgh.com/reports/state-of-the-cedi/${month}`;
  const { data: all } = await createReadOnlyServerClient().from("reports").select("edition").eq("kind", "state-of-the-cedi").order("edition");
  const eds = (all || []).map((e) => e.edition);
  const i = eds.indexOf(month);
  return (
    <PageShell>
      <p className="font-ui text-xs mb-2"><Link href="/reports" className="text-[#E3120B]">← Reports</Link></p>
      <p className="kicker">State of the Cedi</p>
      <h1 className="font-headline text-[32px] leading-tight text-[#121212]">{monthLabel(month)}{!d.complete && <span className="text-[18px] text-[#5B5B5B]"> — month in progress</span>}</h1>
      <p className="font-ui text-xs text-[#5B5B5B] mt-1">By <Link href="/authors/data-desk" className="underline">StatsGH Data Desk</Link> · source: <a className="underline" href={d.source_url}>{d.source}</a> · compiled {fmtDate(r.compiled_at)}</p>
      <div className="my-4"><ShareBar url={url} title={`State of the Cedi: ${monthLabel(month)}`} /></div>
      {sentence && <p className="bg-[#FAF7F2] border-l-4 border-[#E3120B] p-4 mb-6 font-serif text-[17px] leading-[1.7]">{sentence}</p>}
      <MiniChart data={(usd.series || []).map((p: [string, number]) => ({ x: p[0], y: Number(p[1]) }))} label="GH₵ per US dollar, Bank of Ghana interbank mid-rate (higher = weaker cedi)" height={280} />
      <div className="overflow-x-auto mt-6">
        <table className="w-full font-ui text-sm border-collapse">
          <thead><tr className="text-left text-[#5B5B5B] border-b border-[#D9D9D9]"><th className="py-2 pr-3">GH₵ per</th><th className="py-2 pr-3 text-right">Start</th><th className="py-2 pr-3 text-right">End</th><th className="py-2 pr-3 text-right">High</th><th className="py-2 pr-3 text-right">Low</th><th className="py-2 pr-3 text-right">Month change</th><th className="py-2 text-right">Days</th></tr></thead>
          <tbody>{Object.entries(d.pairs).map(([k, p]: [string, any]) => {
            const c = chg(p.end, p.start);
            return (
              <tr key={k} className="border-b border-[#EEE] tabular-nums">
                <td className="py-2 pr-3">{NAMES[k] || k}</td>
                <td className="py-2 pr-3 text-right">{Number(p.start.value).toFixed(4)}</td>
                <td className="py-2 pr-3 text-right font-semibold">{Number(p.end.value).toFixed(4)}</td>
                <td className="py-2 pr-3 text-right">{Number(p.high.value).toFixed(4)}<span className="block text-[11px] text-[#5B5B5B]">{fmtDate(p.high.date)}</span></td>
                <td className="py-2 pr-3 text-right">{Number(p.low.value).toFixed(4)}<span className="block text-[11px] text-[#5B5B5B]">{fmtDate(p.low.date)}</span></td>
                <td className={`py-2 pr-3 text-right ${c == null ? "" : c > 0 ? "text-[#E3120B]" : "text-[#2E7D32]"}`}>{c == null ? "—" : `${c > 0 ? "+" : ""}${c.toFixed(2)}%`}</td>
                <td className="py-2 text-right">{p.days}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      <p className="font-ui text-[11px] text-[#5B5B5B] mt-2">Start and end are the first and last Bank of Ghana fixings stored for the month. A positive change means the cedi lost value against that currency.</p>
      <nav className="flex justify-between font-ui text-sm mt-10 border-t border-[#D9D9D9] pt-3">
        {i > 0 ? <Link className="text-[#E3120B]" href={`/reports/state-of-the-cedi/${eds[i - 1]}`}>← {monthLabel(eds[i - 1])}</Link> : <span />}
        {i >= 0 && i < eds.length - 1 ? <Link className="text-[#E3120B]" href={`/reports/state-of-the-cedi/${eds[i + 1]}`}>{monthLabel(eds[i + 1])} →</Link> : <span />}
      </nav>
    </PageShell>
  );
}
