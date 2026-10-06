// Ghana Research Watch publisher. Auth: x-grw-secret header == GRW_PUBLISH_SECRET.
// No AI calls, no tweets, no other functions invoked.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, x-grw-secret` };
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const MAX_IMG = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DASH = /[\u2014\u2013]/;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isStr = (v: unknown): v is string => typeof v === "string";

function normaliseUrl(raw: string) {
  const u = new URL(raw);
  u.hostname = u.hostname.toLowerCase();
  u.search = ""; u.hash = "";
  return u.toString().replace(/\/+$/, "");
}
async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
function validate(b: any) {
  const e: Record<string, string> = {};
  const req = (k: string, max?: number) => {
    if (!isStr(b[k]) || !b[k].trim()) e[k] = "required";
    else if (max && b[k].length > max) e[k] = `max ${max} chars`;
  };
  const opt = (k: string, max: number) => {
    if (b[k] == null) return;
    if (!isStr(b[k])) e[k] = "must be a string";
    else if (b[k].length > max) e[k] = `max ${max} chars`;
  };
  req("title", 200); req("summary", 500); req("body_html"); req("research_scope");
  if (!isStr(b.slug) || !/^[a-z0-9-]+$/.test(b.slug) || b.slug.length > 90) e.slug = "must match ^[a-z0-9-]+$, max 90";
  opt("subtitle", 300); opt("seo_description", 140); opt("twitter_post", 280); opt("why_it_matters", 400);
  opt("author_name", 120); opt("image_caption", 500); opt("image_source", 80);
  if (isStr(b.body_html)) {
    if (/<script/i.test(b.body_html)) e.body_html = "contains <script";
    else if (/<iframe/i.test(b.body_html)) e.body_html = "contains <iframe";
    else if (/\son[a-z]+\s*=/i.test(b.body_html)) e.body_html = "contains on* attribute";
    else if (/javascript:/i.test(b.body_html)) e.body_html = "contains javascript: URL";
  }
  for (const k of ["title", "summary", "body_html", "research_scope", "twitter_post"]) {
    if (isStr(b[k]) && DASH.test(b[k]) && !e[k]) e[k] = "contains em/en dash";
  }
  if (b.tags != null && (!Array.isArray(b.tags) || !b.tags.every(isStr))) e.tags = "must be string[]";
  if (b.key_data != null) {
    if (!Array.isArray(b.key_data) || b.key_data.length > 4) e.key_data = "array of max 4";
    // deno-lint-ignore no-explicit-any
    else if (!b.key_data.every((k: any) => k && isStr(k.label) && (isStr(k.value) || typeof k.value === "number"))) e.key_data = "each item needs label and value";
  }
  if (b.image_url != null && b.image_base64 != null) e.image = "give image_url OR image_base64";
  if (b.image_url != null && (!isStr(b.image_url) || !/^https?:\/\//i.test(b.image_url))) e.image_url = "must be http(s) URL";
  if (b.image_base64 != null) {
    if (!isStr(b.image_base64)) e.image_base64 = "must be a string";
    if (!EXT[b.image_mime]) e.image_mime = "jpeg|png|webp required";
  }
  const s = b.source;
  if (!s || typeof s !== "object") e.source = "required";
  else {
    if (!isStr(s.url)) e["source.url"] = "required";
    else { try { const u = new URL(s.url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { e["source.url"] = "invalid URL"; } }
    if (!isStr(s.title) || !s.title.trim()) e["source.title"] = "required";
    if (s.repository != null && !isStr(s.repository)) e["source.repository"] = "must be a string";
    if (s.university != null && !isStr(s.university)) e["source.university"] = "must be a string";
  }
  if (b.publish != null && typeof b.publish !== "boolean") e.publish = "boolean";
  if (b.dry_run != null && typeof b.dry_run !== "boolean") e.dry_run = "boolean";
  if (b.scheduled_at != null) {
    const t = isStr(b.scheduled_at) ? Date.parse(b.scheduled_at) : NaN;
    if (isNaN(t)) e.scheduled_at = "invalid ISO date";
  }
  return e;
}

function decodeBase64(s: string) {
  const clean = s.replace(/^data:[^,]+,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`image download ${r.status}`);
    const mime = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) throw new Error("not an image");
    if (Number(r.headers.get("content-length") || 0) > MAX_IMG) throw new Error("image too large");
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > MAX_IMG) throw new Error("image too large");
    return { bytes, mime };
  } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("GRW_PUBLISH_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-grw-secret") ?? "", secret)) return json({ error: "Unauthorized" }, 401);

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "Invalid JSON" }, 400);

  const errors = validate(b);
  if (Object.keys(errors).length) return json({ error: "Validation failed", fields: errors }, 422);

  let imgBytes: Uint8Array | null = null; let imgMime = "";
  if (b.image_base64) {
    try { imgBytes = decodeBase64(b.image_base64); } catch { return json({ error: "Validation failed", fields: { image_base64: "invalid base64" } }, 422); }
    if (imgBytes.length > MAX_IMG) return json({ error: "Validation failed", fields: { image_base64: "max 5 MB" } }, 422);
    imgMime = b.image_mime;
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sourceUrl = normaliseUrl(b.source.url);
  const dedupeKey = await sha256("grw:" + sourceUrl);

  const { data: existing } = await supabase.from("newsroom_articles")
    .select("generated_article_id").eq("dedupe_key", dedupeKey).not("generated_article_id", "is", null).limit(1).maybeSingle();
  if (existing?.generated_article_id) {
    const { data: a } = await supabase.from("articles").select("id, slug, category_slug").eq("id", existing.generated_article_id).maybeSingle();
    const slug = a?.slug ?? null;
    return json({ status: "exists", article_id: existing.generated_article_id, slug, url: slug ? `https://www.statsgh.com/${a?.category_slug || "data-and-research"}/${slug}` : null });
  }

  let slug: string = b.slug;
  const { data: clash } = await supabase.from("articles").select("id").eq("slug", slug).limit(1).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  const { data: cat } = await supabase.from("categories").select("id").eq("slug", "data-and-research").maybeSingle();

  const scope: string = b.research_scope.trim();
  const body = `${b.body_html}<h3>Research Scope</h3><p>${esc(scope)}</p>`;
  const wordCount = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const tags = [...new Set([...(b.tags || []), "Ghana Research Watch", "research", "Ghana"])];
  const now = new Date().toISOString();
  const sched = b.scheduled_at && Date.parse(b.scheduled_at) > Date.now() ? new Date(b.scheduled_at).toISOString() : null;
  const status = sched ? "scheduled" : b.publish === true ? "published" : "draft";

  const row: Record<string, unknown> = {
    title: b.title.trim(), slug, summary: b.summary.trim(), subtitle: b.subtitle ?? null,
    seo_description: b.seo_description ?? null, author_name: b.author_name?.trim() || "StatsGH Newsroom",
    body, research_scope: scope, category_slug: "data-and-research", category_id: cat?.id ?? null,
    section: "research", tags, hero_image_url: null, image_source: b.image_source || "statsgh_generated",
    image_caption: b.image_caption ?? null, key_data: b.key_data ?? [], why_it_matters: b.why_it_matters ?? null,
    twitter_post: b.twitter_post ?? null, word_count: wordCount, dedupe_key: dedupeKey,
    editorial_status: "approved_editor", approved_by: "research-watch", approved_at: now,
    skip_auto_tweet: true, is_sponsored: false, status,
    is_published: status === "published", published_at: status === "published" ? now : null,
    scheduled_at: sched,
  };

  if (b.dry_run === true) return json({ status: "dry_run", would_insert: row, dedupe_key: dedupeKey });

  if (b.image_url) {
    try { const d = await downloadImage(b.image_url); imgBytes = d.bytes; imgMime = d.mime; }
    catch (e) { return json({ error: "Image download failed", detail: (e as Error).message }, 422); }
  }
  if (imgBytes) {
    const ext = EXT[imgMime] || imgMime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "img";
    const path = `research-watch/${slug}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, imgBytes, { contentType: imgMime, upsert: false });
    if (upErr) return json({ error: "Image upload failed", detail: upErr.message }, 500);
    row.hero_image_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  }

  const { data: art, error: artErr } = await supabase.from("articles").insert(row).select("id, slug").single();
  if (artErr || !art) return json({ error: "Article insert failed", detail: artErr?.message }, 500);

  const s = b.source;
  const { error: nrErr } = await supabase.from("newsroom_articles").insert({
    source_name: `${s.repository ?? ""} (${s.university ?? ""})`, source_url: s.url,
    original_headline: s.title, original_summary: null, dedupe_key: dedupeKey,
    processing_status: "completed", generated_article_id: art.id, category_hint: "data-and-research",
  });
  if (nrErr) {
    await supabase.from("articles").delete().eq("id", art.id);
    return json({ error: "Source record insert failed", detail: nrErr.message }, 500);
  }

  return json({
    status: status === "published" ? "created" : status,
    article_id: art.id, slug: art.slug, url: `https://www.statsgh.com/data-and-research/${art.slug}`,
  }, 201);
});
