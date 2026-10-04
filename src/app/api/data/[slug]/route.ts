import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { datasetMeta, datasetRows, getDataset, LICENCE, toCsv } from "@/lib/dataVault";

export const dynamic = "force-dynamic";

// Best-effort per-IP limit (per server instance): 60 requests a minute.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n += 1;
  if (hits.size > 5000) hits.clear();
  return h.n > 60;
}

const CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limited(ip)) return Response.json({ error: "Rate limit exceeded: 60 requests per minute" }, { status: 429, headers: { "Retry-After": "60" } });
  const d = getDataset(slug);
  if (!d) return Response.json({ error: "Unknown dataset" }, { status: 404 });
  const sb = createReadOnlyServerClient();
  try {
    const [rows, meta] = await Promise.all([datasetRows(sb, d), datasetMeta(sb, d)]);
    const format = new URL(req.url).searchParams.get("format");
    const headers: Record<string, string> = { "Cache-Control": CACHE, "Access-Control-Allow-Origin": "*" };
    if (format === "csv") {
      return new Response(toCsv(d.columns, rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="statsgh-${d.slug}.csv"` } });
    }
    return Response.json({
      dataset: d.slug, title: d.title, description: d.description, source: d.source, source_url: d.sourceUrl,
      frequency: d.frequency, licence: LICENCE.name, licence_url: LICENCE.url, attribution: LICENCE.attribution,
      permalink: `https://www.statsgh.com/data-vault/${d.slug}`, last_updated: meta.lastUpdated, row_count: rows.length,
      columns: d.columns, rows,
    }, { headers });
  } catch {
    return Response.json({ error: "Dataset temporarily unavailable" }, { status: 503 });
  }
}
