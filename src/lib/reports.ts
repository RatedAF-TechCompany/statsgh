// Helpers for the auto-compiled reports. Text is generated only from the stored numbers.
export type Obs = { value: number; date?: string; period?: string } | null | undefined;

export const chg = (now: Obs, then: Obs) =>
  now && then && Number(then.value) !== 0 ? ((Number(now.value) - Number(then.value)) / Number(then.value)) * 100 : null;
export const diff = (now: Obs, then: Obs) => (now && then ? Number(now.value) - Number(then.value) : null);

export const fmtDate = (d?: string | null) =>
  d ? new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
export const monthLabel = (ym: string) =>
  new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Plain-English summary of a scorecard. Only describes values present in the data. */
export function scorecardSummary(d: any): string[] {
  const out: string[] = [];
  const u = d.usd || {};
  const w = chg(u.now, u.week);
  if (u.now && w != null) {
    // Higher GHS per USD means the cedi weakened.
    const dir = Math.abs(w) < 0.05 ? "was broadly unchanged" : w > 0 ? `weakened ${Math.abs(w).toFixed(2)}%` : `strengthened ${Math.abs(w).toFixed(2)}%`;
    out.push(`The cedi ${dir} against the US dollar over the week, at GH₵${Number(u.now.value).toFixed(4)} per dollar on the Bank of Ghana interbank market (${fmtDate(u.now.date)}).`);
  }
  const t = d.tbills?.["91"];
  const td = diff(t?.now, t?.week);
  if (t?.now && td != null && t.now.date !== t.week?.date) {
    out.push(`The 91-day treasury bill rate ${Math.abs(td) < 0.005 ? "held" : td > 0 ? "rose" : "fell"} to ${Number(t.now.value).toFixed(2)}% at the latest auction (${fmtDate(t.now.date)}).`);
  }
  if (d.policy) {
    const pv = d.policy.prev?.value;
    const verb = pv == null || Number(pv) === Number(d.policy.value) ? "stands at" : Number(d.policy.value) > Number(pv) ? "was raised to" : "was cut to";
    out.push(`The Bank of Ghana policy rate ${verb} ${Number(d.policy.value).toFixed(1)}% (effective ${fmtDate(d.policy.date)}).`);
  }
  if (d.inflation) {
    const p = d.inflation.prev;
    const tail = p ? `, ${Number(d.inflation.value) > Number(p.value) ? "up from" : Number(d.inflation.value) < Number(p.value) ? "down from" : "unchanged from"} ${Number(p.value)}% the month before` : "";
    out.push(`The latest headline inflation reading is ${Number(d.inflation.value)}% for ${monthLabel(String(d.inflation.period).slice(0, 7))}${tail}.`);
  }
  const g = d.gse || {};
  const gw = chg(g.now, g.week);
  if (g.now && gw != null) out.push(`The GSE Composite Index ${gw >= 0 ? "gained" : "lost"} ${Math.abs(gw).toFixed(2)}% on the week to ${Number(g.now.value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}.`);
  const up = d.movers?.up?.[0];
  const dn = d.movers?.down?.[0];
  if (up || dn) out.push(`Among listed stocks${up ? `, ${up.name} rose most (+${up.pct}%)` : ""}${up && dn ? " and" : ""}${dn ? ` ${dn.name} fell most (${dn.pct}%)` : ""}.`);
  return out;
}
