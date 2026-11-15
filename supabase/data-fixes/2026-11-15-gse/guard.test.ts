// Unit test of the index sanity check (copied verbatim from index.ts) against the stored Oct–Nov 2026 series.
const MAX_MOVE = 0.20;
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
function suspect(v: number | null, ref: number[], vol: number | null): string | null {
  if (v === null) return null;
  if (vol !== null && vol > 0 && v === vol) return `equals volume ${vol}`;
  if (!ref.length) return null;
  const m = median(ref); const move = Math.abs(v / m - 1);
  return move > MAX_MOVE ? `${(move * 100).toFixed(1)}% from recent median ${m}` : null;
}
const series: [string, number, number][] = [["2026-10-26",14014.16,904876],["2026-10-27",14052.96,798643],["2026-10-28",14048.78,6878491],["2026-10-29",14246.71,643883],["2026-10-30",14302.27,1307441],["2026-11-02",503067,503067],["2026-11-03",14155.02,12130104],["2026-11-04",14112.83,2625485],["2026-11-05",13966.79,996583],["2026-11-06",14000.37,2928322],["2026-11-09",14010.02,1425030],["2026-11-10",13944,2671892],["2026-11-11",13972.36,570598],["2026-11-12",13996.43,1480755],["2026-11-13",13960.4,1654749]];
let fails = 0;
// Case A: guard running live (accepted values only feed the reference)
const acc: number[] = [];
for (const [d, ci, vol] of series) { const r = suspect(ci, acc.slice(-5), vol); console.log("A", d, ci, r ?? "ok"); if ((d === "2026-11-02") !== !!r) fails++; if (!r) acc.push(ci); }
// Case B: the bad value is already stored; the next good day must still pass (median protects it)
const refB = [14048.78, 14246.71, 14302.27, 503067];
const rB = suspect(14155.02, refB, 12130104); console.log("B 3 Nov with bad stored 2 Nov:", rB ?? "ok"); if (rB) fails++;
// Case C: a genuine 25% crash is rejected (needs a human), a 15% move passes
console.log("C -25%:", suspect(14000 * 0.75, [14000], 1) ?? "ok", "| -15%:", suspect(14000 * 0.85, [14000], 1) ?? "ok");
console.log(fails ? `FAIL ${fails}` : "ALL PASS"); if (fails) throw new Error("fail");
