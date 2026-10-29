import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resource limits: the job previously hit WORKER_RESOURCE_LIMIT. Keep each run small.
const MAX_PER_RUN = 5;
const FETCH_TIMEOUT_MS = 10_000;
const AI_TIMEOUT_MS = 45_000;
const ARTICLE_TIMEOUT_MS = 60_000;

function timedFetch(url: string, init: RequestInit = {}, ms = FETCH_TIMEOUT_MS) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms))]);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Query derivation ----------
const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","at","by","from",
  "is","are","was","were","be","been","being","as","that","this","it","its","into",
  "ghana","ghana's","ghanaian","new","says","said","after","over","amid","up","down",
]);

function deriveQuery(title: string, category: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 3);
  if (words.length) return words.join(" ");
  return (category || "ghana business").replace(/-/g, " ");
}

// ---------- Free source: Openverse ----------
// https://api.openverse.engineering/v1/images/ — CC-licensed, no key
async function fetchOpenverse(query: string): Promise<{ url: string; creator: string } | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&aspect_ratio=wide&size=large&page_size=5`;
    const res = await timedFetch(url, { headers: { "User-Agent": "StatsGH/1.0 (editorial)" } });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data.results || []).find((r: any) => r.url && (r.width ?? 0) >= 700);
    if (!hit) return null;
    return { url: hit.url, creator: hit.creator || "Unknown" };
  } catch (e) {
    console.log("Openverse error:", (e as Error).message);
    return null;
  }
}

// ---------- Free source: Wikimedia Commons ----------
// MediaWiki search API → file info; no key required
async function fetchWikimedia(query: string): Promise<{ url: string; creator: string } | null> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(
      query + " filetype:bitmap"
    )}&srnamespace=6&srlimit=5&origin=*`;
    const sres = await timedFetch(searchUrl, { headers: { "User-Agent": "StatsGH/1.0" } });
    if (!sres.ok) return null;
    const sdata = await sres.json();
    const hits = sdata.query?.search || [];
    for (const hit of hits) {
      const title = hit.title;
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&titles=${encodeURIComponent(
        title
      )}&iiprop=url|size|extmetadata&origin=*`;
      const ires = await timedFetch(infoUrl, { headers: { "User-Agent": "StatsGH/1.0" } });
      if (!ires.ok) continue;
      const idata = await ires.json();
      const pages = idata.query?.pages || {};
      const page: any = Object.values(pages)[0];
      const info = page?.imageinfo?.[0];
      if (!info) continue;
      const w = info.width || 0;
      const h = info.height || 0;
      if (w < 700 || h < 1) continue;
      const ratio = w / h;
      if (ratio < 1.2 || ratio > 2.5) continue;
      const creator = (info.extmetadata?.Artist?.value || "Wikimedia").replace(/<[^>]+>/g, "").trim();
      return { url: info.url, creator };
    }
    return null;
  } catch (e) {
    console.log("Wikimedia error:", (e as Error).message);
    return null;
  }
}

// ---------- AI fallback ----------
async function generateAiImage(prompt: string, supabase: any, slug: string): Promise<string | null> {
  try {
    const key = (Deno.env.get("AI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY"));
    if (!key) return null;
    const res = await timedFetch((Deno.env.get("AI_GATEWAY_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Conceptual editorial photograph for a business news article. Subject: ${prompt}. Single real-world object on a seamless solid colour studio background, shallow depth of field, directional lighting, photorealistic, 16:9. Absolutely no text, no logos, no people.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    }, AI_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = await res.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const m = imageData?.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return null;
    const [, fmt, b64] = m;
    const bytes = base64ToBytes(b64);
    const ext = fmt === "png" ? "png" : "jpg";
    const path = `newsroom/${slug}-ai.${ext}`;
    const { error } = await supabase.storage
      .from("media")
      .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : "png"}`, upsert: true });
    if (error) return null;
    return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// SVG -> PNG via resvg-wasm (works in the Supabase edge runtime). Fonts are
// fetched once per isolate because the runtime has no system fonts.
let resvgReady: Promise<Uint8Array[]> | null = null;
function loadResvg(): Promise<Uint8Array[]> {
  if (!resvgReady) {
    resvgReady = (async () => {
      const wasm = await fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
      await initWasm(wasm);
      const fonts = await Promise.all([
        "https://cdn.jsdelivr.net/fontsource/fonts/oswald@latest/latin-700-normal.ttf",
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
      ].map(async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer())));
      return fonts;
    })().catch((e) => { resvgReady = null; throw e; });
  }
  return resvgReady;
}
export async function svgToPng(svg: string): Promise<Uint8Array> {
  const fontBuffers = await loadResvg();
  const r = new Resvg(svg, { font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: "Inter" } });
  return r.render().asPng();
}

// ---------- Main ----------
// (b) StatsGH chart card from articles.key_data ([{label,value}]). PNG, house
// style: heavy condensed headline font, plain sans body, no emojis.
async function renderStatsChart(a: any, supabase: any): Promise<string | null> {
  const kd = Array.isArray(a.key_data) ? a.key_data.filter((k: any) => k?.label && k?.value != null).slice(0, 4) : [];
  if (!kd.length) return null;
  const esc = (x: unknown) => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const rows = kd.map((k: any, i: number) => `
    <text x="80" y="${300 + i * 150}" font-family="Oswald" font-weight="700" font-size="88" fill="#0b6e4f">${esc(k.value)}</text>
    <text x="80" y="${350 + i * 150}" font-family="Inter" font-size="34" fill="#222">${esc(k.label).slice(0, 70)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${360 + kd.length * 150}" viewBox="0 0 1200 ${360 + kd.length * 150}">
  <rect width="100%" height="100%" fill="#fafaf7"/><rect width="1200" height="14" fill="#0b6e4f"/>
  <text x="80" y="150" font-family="Oswald" font-weight="700" font-size="52" fill="#111">${esc(a.title).slice(0, 60)}</text>
  ${rows}
  <text x="80" y="${300 + kd.length * 150}" font-family="Inter" font-size="26" fill="#666">StatsGH.com</text></svg>`;
  let png: Uint8Array;
  try { png = await svgToPng(svg); } catch (e) { console.error("chart png render failed", e); return null; }
  const path = `charts/${a.slug}-${Date.now()}.png`;
  const { error } = await supabase.storage.from("article-images")
    .upload(path, new Blob([png as BlobPart], { type: "image/png" }), { contentType: "image/png", upsert: true });
  if (error) return null;
  return supabase.storage.from("article-images").getPublicUrl(path).data.publicUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(1, Number(body.limit ?? MAX_PER_RUN) || MAX_PER_RUN), MAX_PER_RUN);
    const force = Boolean(body.force ?? false);

    let q = supabase
      .from("articles")
      .select("id, title, slug, section, category_slug, hero_image_url, key_data")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (!force) q = q.is("hero_image_url", null);

    const { data: articles, error } = await q;
    if (error) throw error;

    const counts = { openverse: 0, wikimedia: 0, ai: 0, none: 0, failed: 0 };
    const results: any[] = [];

    // One article at a time, each with its own time budget; a failure is logged and skipped.
    for (const a of articles || []) {
      const query = deriveQuery(a.title, a.category_slug || a.section || "");
      try {
        const r = await withTimeout((async () => {
          // (b) Image rule, 29 Oct 2026: official-source image or a StatsGH chart only.
          // Openverse, Wikimedia and AI illustrations are no longer used.
          const chart = await renderStatsChart(a, supabase);
          if (chart) return { url: chart, source: "statsgh_chart", caption: "Chart: StatsGH" };
          return null;
        })(), ARTICLE_TIMEOUT_MS, "article");

        if (r) {
          const { error: upErr } = await supabase.from("articles")
            .update({ hero_image_url: r.url, image_source: r.source, image_caption: r.caption }).eq("id", a.id);
          if (upErr) throw upErr;
          (counts as any)[r.source === "ai_illustration" ? "ai" : r.source]++;
          results.push({ id: a.id, source: r.source, query });
        } else {
          counts.none++;
          results.push({ id: a.id, source: "none", query });
        }
      } catch (e) {
        counts.failed++;
        results.push({ id: a.id, source: "failed", error: (e as Error).message, query });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log("backfill-images result", JSON.stringify({ processed: results.length, counts, results }));

    return new Response(
      JSON.stringify({ success: true, processed: results.length, counts, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backfill-images failed", (e as Error).message);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
