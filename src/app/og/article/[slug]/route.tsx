import { ImageResponse } from "next/og";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

export const revalidate = 3600;

interface KeyDatum { label?: string; value?: number | string; unit?: string }

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i;
const NON_STAT_LABEL = /\b(date|day|days|time|hour|year|month|edition|anniversary|session|deadline|phone)\b/i;
const toNum = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "")));

function stats(raw: unknown): KeyDatum[] {
  if (!Array.isArray(raw)) return [];
  return (raw as KeyDatum[]).filter(
    (k) => k?.label && Number.isFinite(toNum(k.value)) && !(k.unit && MONTHS.test(k.unit.trim())) && !NON_STAT_LABEL.test(k.label),
  ).slice(0, 3);
}

const RED = "#E3120B";
const INK = "#121212";
const GREY = "#5B5B5B";
const CREAM = "#FAF7F2";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createReadOnlyServerClient();
  const { data: article } = await supabase
    .from("articles")
    .select("id,title,key_data,section")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  const title = article?.title ?? "StatsGH — Ghana in numbers";
  const items = stats(article?.key_data);
  let source = "";
  if (article?.id) {
    const { data } = await supabase.rpc("get_article_source", { p_article_id: article.id });
    const row = Array.isArray(data) ? data[0] : data;
    source = row?.source_name || (row?.source_url ? new URL(row.source_url).hostname : "");
  }

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "#FFFFFF", padding: "48px 64px", borderTop: `16px solid ${RED}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: INK, display: "flex" }}>
            Stats<span style={{ color: RED }}>GH</span>
          </div>
          {article?.section && <div style={{ fontSize: 22, color: RED, textTransform: "uppercase", letterSpacing: 3 }}>{article.section}</div>}
        </div>
        <div style={{ marginTop: 28, fontSize: items.length ? 48 : 64, fontWeight: 700, color: INK, lineHeight: 1.15, display: "flex" }}>
          {title.length > 140 ? title.slice(0, 137) + "…" : title}
        </div>
        {items.length > 0 && (
          <div style={{ marginTop: "auto", display: "flex", gap: 24 }}>
            {items.map((k, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", background: CREAM, borderLeft: `8px solid ${RED}`, padding: "20px 24px" }}>
                <div style={{ fontSize: 52, fontWeight: 800, color: INK, display: "flex" }}>
                  {toNum(k.value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}{k.unit ? ` ${k.unit}` : ""}
                </div>
                <div style={{ fontSize: 22, color: GREY, marginTop: 6, display: "flex" }}>{String(k.label).slice(0, 60)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: items.length ? 24 : "auto", fontSize: 22, color: GREY, display: "flex", justifyContent: "space-between" }}>
          <span>{source ? `Source: ${source}` : ""}</span>
          <span>statsgh.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
