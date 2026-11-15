// Server-rendered line chart (plain SVG, no JavaScript). Readable at 360 px; source and date are
// printed under it so a screenshot carries them.
export function StaticLineChart({ points, label, fmt }: { points: { date: string; value: number }[]; label: string; fmt: (v: number) => string }) {
  if (points.length < 2) return <p className="font-ui text-sm text-[#5B5B5B]">Not enough stored observations to chart yet.</p>;
  const W = 640, H = 220, P = { l: 8, r: 8, t: 12, b: 22 };
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  return (
    <figure className="my-4">
      <figcaption className="font-ui text-xs text-[#5B5B5B] mb-1">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img" aria-label={`${label}: from ${fmt(points[0].value)} on ${points[0].date} to ${fmt(last.value)} on ${last.date}`} className="block max-w-full">
        <line x1={P.l} x2={W - P.r} y1={y(max)} y2={y(max)} stroke="#EEE" />
        <line x1={P.l} x2={W - P.r} y1={y(min)} y2={y(min)} stroke="#EEE" />
        <text x={P.l} y={y(max) - 3} fontSize="11" fill="#5B5B5B">{fmt(max)}</text>
        <text x={P.l} y={y(min) - 3} fontSize="11" fill="#5B5B5B">{fmt(min)}</text>
        <path d={d} fill="none" stroke="#E3120B" strokeWidth="2" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill="#E3120B" />
        <text x={P.l} y={H - 4} fontSize="11" fill="#5B5B5B">{points[0].date}</text>
        <text x={W - P.r} y={H - 4} fontSize="11" fill="#5B5B5B" textAnchor="end">{last.date}</text>
      </svg>
    </figure>
  );
}
