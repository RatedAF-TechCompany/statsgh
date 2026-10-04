export const dynamic = "force-dynamic"; // live data page: render per request
import Link from "next/link";
import { pageMeta } from "@/lib/pageMeta";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { PageShell, ShareBar } from "@/components/vault/VaultBits";
import { fmtDate, monthLabel } from "@/lib/reports";

export const metadata = pageMeta("/reports", "Reports: Ghana Economy Scorecard and State of the Cedi", "StatsGH's automatically compiled reports, built only from stored official data: the weekly Ghana Economy Scorecard and the monthly State of the Cedi.");

export default async function ReportsPage() {
  const { data } = await createReadOnlyServerClient().from("reports").select("kind, edition, compiled_at").order("edition", { ascending: false });
  const sc = (data || []).filter((r) => r.kind === "economy-scorecard");
  const ce = (data || []).filter((r) => r.kind === "state-of-the-cedi");
  const Block = ({ title, blurb, base, rows, label }: { title: string; blurb: string; base: string; rows: typeof sc; label: (e: string) => string }) => (
    <section className="border-t-4 border-[#E3120B] pt-3">
      <h2 className="font-headline text-[24px] text-[#121212]"><Link href={base} className="hover:text-[#E3120B]">{title}</Link></h2>
      <p className="font-serif text-[16px] text-[#5B5B5B] mt-1 mb-3">{blurb}</p>
      {rows.length === 0 ? <p className="font-ui text-sm">No editions compiled yet.</p> : (
        <ul className="font-ui text-sm space-y-1.5">
          {rows.map((r) => <li key={r.edition}><Link className="text-[#121212] hover:text-[#E3120B] underline-offset-2 hover:underline" href={`${base}/${r.edition}`}>{label(r.edition)}</Link></li>)}
        </ul>
      )}
    </section>
  );
  return (
    <PageShell>
      <div className="border-b border-[#E3120B] pb-3 mb-4"><h1 className="section-label text-base">Reports</h1></div>
      <p className="font-serif text-[18px] text-[#5B5B5B] max-w-[760px] mb-3">Compiled automatically by the StatsGH Data Desk from datasets in our <Link href="/data-vault" className="text-[#E3120B] underline">Data Vault</Link>. Every figure carries its source and date; where a figure is missing it is left out, not estimated.</p>
      <div className="mb-6"><ShareBar url="https://www.statsgh.com/reports" title="StatsGH Reports" /></div>
      <div className="grid md:grid-cols-2 gap-8">
        <Block title="Ghana Economy Scorecard" blurb="Weekly, every Sunday: cedi, T-bills, policy rate, inflation, GSE and commodities versus last week, month and year." base="/reports/economy-scorecard" rows={sc} label={(e) => `Week ending ${fmtDate(e)}`} />
        <Block title="State of the Cedi" blurb="Monthly: the cedi's start, end, high and low against the dollar, pound and euro." base="/reports/state-of-the-cedi" rows={ce} label={monthLabel} />
      </div>
    </PageShell>
  );
}
