"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Download, Image as ImageIcon, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { loadCatalog, loadSeries, type CatalogItem, type ExplorerKind, type SeriesData } from "@/lib/explorerCatalog";
import { asOfLabel } from "@/lib/dataProvenance";

const KIND_LABEL: Record<ExplorerKind, string> = { tracker: "Trackers", indicator: "Indicators", "key-number": "Key numbers" };
const fmt = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 2 });

function pageUrl(id: string) {
  return `${window.location.origin}/explorer?s=${encodeURIComponent(id)}`;
}

function drawCard(item: CatalogItem, d: SeriesData): Promise<Blob | null> {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 630;
  const g = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const tok = (n: string, f: string) => (css.getPropertyValue(n).trim() ? `hsl(${css.getPropertyValue(n).trim()})` : f);
  const bg = tok("--background", "#ffffff"), ink = tok("--foreground", "#121212"), muted = tok("--muted-foreground", "#5b5b5b"), red = "#E3120B";
  g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
  g.fillStyle = red; g.fillRect(0, 0, 1200, 12); g.fillRect(60, 60, 60, 8);
  g.fillStyle = ink; g.font = "bold 34px Georgia, serif"; g.fillText("StatsGH", 60, 115);
  g.font = "bold 44px Georgia, serif";
  const words = item.name.split(" "); let line = ""; let y = 185;
  for (const w of words) {
    if (g.measureText(line + w).width > 1080 && line) { g.fillText(line.trim(), 60, y); line = ""; y += 54; if (y > 300) break; }
    line += w + " ";
  }
  if (y <= 300) g.fillText(line.trim(), 60, y);
  const pts = d.points; const last = pts[pts.length - 1];
  if (last) {
    g.fillStyle = red; g.font = "bold 96px Arial, sans-serif";
    g.fillText(`${fmt(last.value)}${item.unit === "%" ? "%" : ""}`, 60, 430);
    g.fillStyle = muted; g.font = "28px Arial, sans-serif";
    g.fillText(`${item.unit && item.unit !== "%" ? item.unit + " · " : ""}${asOfLabel(last.date)}`, 60, 475);
  }
  if (pts.length > 2) {
    const xs = 640, xw = 500, yt = 340, yh = 170;
    const vals = pts.map((p) => p.value); const mn = Math.min(...vals), mx = Math.max(...vals) || 1;
    g.strokeStyle = red; g.lineWidth = 4; g.beginPath();
    pts.forEach((p, i) => {
      const x = xs + (i / (pts.length - 1)) * xw;
      const yy = yt + yh - ((p.value - mn) / (mx - mn || 1)) * yh;
      i ? g.lineTo(x, yy) : g.moveTo(x, yy);
    });
    g.stroke();
  }
  g.fillStyle = muted; g.font = "24px Arial, sans-serif";
  g.fillText(`Source: ${d.source}`.slice(0, 85), 60, 560);
  g.fillText("statsgh.com/explorer", 60, 595);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

const DataExplorer = () => {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ExplorerKind | "all">("all");
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s) setSelId(s);
  }, []);

  const { data: catalog, isLoading } = useQuery({ queryKey: ["explorer-catalog"], queryFn: loadCatalog });
  const selected = catalog?.find((c) => c.id === selId) ?? null;
  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["explorer-series", selId],
    queryFn: () => loadSeries(selected!),
    enabled: !!selected,
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (catalog || []).filter((c) => (kind === "all" || c.kind === kind) && (!t || `${c.name} ${c.group}`.toLowerCase().includes(t)));
  }, [catalog, q, kind]);

  const pick = (id: string) => {
    setSelId(id);
    window.history.replaceState(null, "", `/explorer?s=${encodeURIComponent(id)}`);
  };

  const copyLink = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(pageUrl(selected.id));
    toast({ title: "Link copied" });
  };

  const downloadCsv = () => {
    if (!selected || !series) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [["date", "value", "unit", "source"].join(","), ...series.points.map((p) => [p.date, p.value, esc(selected.unit), esc(series.source)].join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = `statsgh-${selected.id}.csv`;
    a.click();
  };

  const shareCard = async (target: "x" | "whatsapp" | "download") => {
    if (!selected || !series) return;
    const blob = await drawCard(selected, series);
    if (!blob) return;
    const url = pageUrl(selected.id);
    const text = `${selected.name} — StatsGH`;
    const file = new File([blob], `statsgh-${selected.id}.png`, { type: "image/png" });
    if (target !== "download" && (navigator as any).canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text, url }); return; } catch { /* fall through */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    if (target === "x") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    if (target === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
    if (target !== "download") toast({ title: "Image card downloaded", description: "Attach it to your post." });
  };

  const pts = series?.points ?? [];
  const last = pts[pts.length - 1];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="font-serif text-4xl font-bold mb-2">Data Explorer</h1>
        <p className="text-muted-foreground mb-6">Search every indicator, tracker and key number stored on StatsGH. Every figure shows its source and when it was last updated.</p>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search data…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search data" />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(["all", "tracker", "indicator", "key-number"] as const).map((k) => (
                <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
                  {k === "all" ? "All" : KIND_LABEL[k]}
                </Button>
              ))}
            </div>
            <div className="border border-border max-h-[600px] overflow-y-auto">
              {isLoading ? <div className="p-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                : filtered.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No matching data.</p>
                : filtered.slice(0, 300).map((c) => (
                  <button key={c.id} onClick={() => pick(c.id)}
                    className={`block w-full text-left px-3 py-2 border-b border-border text-sm hover:bg-muted ${c.id === selId ? "bg-muted font-semibold" : ""}`}>
                    <span className="block text-xs uppercase tracking-wide text-muted-foreground">{c.group}</span>
                    <span className="line-clamp-2">{c.name}</span>
                  </button>
                ))}
            </div>
            {filtered.length > 300 && <p className="text-xs text-muted-foreground mt-2">Showing 300 of {filtered.length} — refine your search.</p>}
          </aside>

          <section className="border border-border p-5 min-h-[400px]">
            {!selected ? (
              <p className="text-muted-foreground">Pick an item on the left to see its chart and source.</p>
            ) : seriesLoading || !series ? (
              <Skeleton className="h-80" />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="font-serif text-2xl font-bold">{selected.name}</h2>
                  <Badge variant="outline">{KIND_LABEL[selected.kind]}</Badge>
                </div>
                {pts.length === 0 ? (
                  <p className="my-8 text-muted-foreground">Data unavailable — no figures are stored for this item yet.</p>
                ) : (
                  <>
                    <p className="text-4xl font-bold my-3">{fmt(last!.value)}{selected.unit === "%" ? "%" : ""} <span className="text-base font-normal text-muted-foreground">{selected.unit !== "%" ? selected.unit : ""} · {asOfLabel(last!.date)}</span></p>
                    {pts.length > 1 ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={pts}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={30} />
                            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={60} />
                            <Tooltip formatter={(v: number) => fmt(v)} />
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" dot={pts.length < 30} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{series.note ?? `Tracking started ${asOfLabel(pts[0].date)} — a chart appears once more readings are stored.`}</p>
                    )}
                    {pts.length > 1 && <p className="text-xs text-muted-foreground mt-1">Tracking started {asOfLabel(pts[0].date)} · {pts.length} readings</p>}
                  </>
                )}
                <p className="text-sm mt-4">
                  Source: {series.sourceUrl ? <a className="underline" href={series.sourceUrl} target={series.sourceUrl.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{series.source}</a> : series.source}
                  {" · "}Last updated {asOfLabel(series.updated)}
                  {selected.href && <> · <a className="underline" href={selected.href}>{selected.kind === "key-number" ? "Read the article" : "Full page"}</a></>}
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  <Button size="sm" variant="outline" onClick={copyLink}><Link2 className="h-4 w-4 mr-1" />Copy link</Button>
                  <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!pts.length}><Download className="h-4 w-4 mr-1" />Download CSV</Button>
                  <Button size="sm" variant="outline" onClick={() => shareCard("download")} disabled={!pts.length}><ImageIcon className="h-4 w-4 mr-1" />Image card</Button>
                  <Button size="sm" variant="outline" onClick={() => shareCard("x")} disabled={!pts.length}>Share to X</Button>
                  <Button size="sm" variant="outline" onClick={() => shareCard("whatsapp")} disabled={!pts.length}>Share to WhatsApp</Button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DataExplorer;
