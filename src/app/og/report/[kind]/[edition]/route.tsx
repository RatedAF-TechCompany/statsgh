import { ImageResponse } from "next/og";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { chg, fmtDate, monthLabel } from "@/lib/reports";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; edition: string }> }) {
  const { kind, edition } = await params;
  const { data: r } = await createReadOnlyServerClient().from("reports").select("data").eq("kind", kind).eq("edition", edition).maybeSingle();
  const d: any = r?.data;
  const stats: { label: string; value: string }[] = [];
  let title = "StatsGH Reports";
  if (d && kind === "economy-scorecard") {
    title = `Ghana Economy Scorecard · week ending ${fmtDate(edition)}`;
    if (d.usd?.now) stats.push({ label: "GH₵ per US$", value: Number(d.usd.now.value).toFixed(2) });
    if (d.tbills?.["91"]?.now) stats.push({ label: "91-day T-bill", value: `${Number(d.tbills["91"].now.value).toFixed(2)}%` });
    if (d.policy) stats.push({ label: "Policy rate", value: `${Number(d.policy.value).toFixed(1)}%` });
    const g = chg(d.gse?.now, d.gse?.week);
    if (g != null) stats.push({ label: "GSE-CI, week", value: `${g > 0 ? "+" : ""}${g.toFixed(2)}%` });
  } else if (d && kind === "state-of-the-cedi") {
    title = `State of the Cedi · ${monthLabel(edition)}`;
    const u = d.pairs?.USDGHS;
    if (u) {
      stats.push({ label: "Month end, GH₵/US$", value: Number(u.end.value).toFixed(2) });
      const c = chg(u.end, u.start);
      if (c != null) stats.push({ label: "Change vs US$", value: `${c > 0 ? "+" : ""}${c.toFixed(2)}%` });
      stats.push({ label: "High", value: Number(u.high.value).toFixed(2) }, { label: "Low", value: Number(u.low.value).toFixed(2) });
    }
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FAF7F2", padding: 60, borderTop: "16px solid #E3120B" }}>
        <div style={{ fontSize: 28, color: "#E3120B", fontWeight: 700 }}>StatsGH</div>
        <div style={{ fontSize: 52, color: "#121212", fontWeight: 700, marginTop: 20, lineHeight: 1.15 }}>{title}</div>
        <div style={{ display: "flex", marginTop: 50, gap: 30 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", borderTop: "4px solid #121212", paddingTop: 12, width: 250 }}>
              <div style={{ fontSize: 50, fontWeight: 700, color: "#121212" }}>{s.value}</div>
              <div style={{ fontSize: 22, color: "#5B5B5B" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", fontSize: 20, color: "#5B5B5B" }}>Sources: Bank of Ghana, Ghana Stock Exchange · statsgh.com/reports</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
