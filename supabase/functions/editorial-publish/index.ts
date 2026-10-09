// Direct editorial publisher. Auth: x-publish-secret header == EDITORIAL_PUBLISH_SECRET.
// Inserts text exactly as given. No AI calls, no rewriting, no tweets or social triggers.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, x-publish-secret` };
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const MAX_IMG = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isStr = (v: unknown): v is string => typeof v === "string";
const has = (b: any, k: string) => b[k] !== undefined && b[k] !== null;

async function loadImage(src: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const m = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (m) {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length > MAX_IMG) throw new Error("image larger than 5 MB");
    return { bytes, mime: m[1].toLowerCase() };
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await fetch(src, { signal: ctl.signal });
    if (!r.ok) throw new Error(`image download ${r.status}`);
    const mime = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) throw new Error("not an image");
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > MAX_IMG) throw new Error("image larger than 5 MB");
    return { bytes, mime };
  } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("EDITORIAL_PUBLISH_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-publish-secret") ?? "", secret)) {
    console.log("editorial-publish: unauthorized");
    return json({ error: "Unauthorized" }, 401);
  }

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b || typeof b !== "object") return json({ error: "Invalid JSON" }, 400);
  const slug = isStr(b.slug) ? b.slug : "";
  const done = (body: unknown, status: number, result: string) => {
    console.log(`editorial-publish: slug=${slug || "-"} result=${result}`);
    return json(body, status);
  };

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const upsert = b.upsert === true;
  const errors: string[] = [];
  if (!SLUG_RE.test(slug)) errors.push("slug must match ^[a-z0-9]+(-[a-z0-9]+)*$");

  const { data: existing } = slug
    ? await db.from("articles").select("id, slug, category_slug, published_at").eq("slug", slug).limit(1).maybeSingle()
    : { data: null };
  if (existing && !upsert) return done({ error: "Slug already exists" }, 409, "conflict");
  const isUpdate = !!existing;

  // Required on insert; on update only checked when provided.
  const need = (k: string) => !isUpdate || has(b, k);
  const strField = (k: string, max: number | null, required: boolean) => {
    if (!need(k) && !required) return;
    if (!has(b, k)) { if (required) errors.push(`${k} is required`); return; }
    if (!isStr(b[k])) { errors.push(`${k} must be a string`); return; }
    if (required && !b[k].trim()) errors.push(`${k} is required`);
    if (max && b[k].length > max) errors.push(`${k} must be at most ${max} characters`);
  };
  strField("title", 200, !isUpdate);
  strField("body", 50000, !isUpdate);
  strField("section", null, !isUpdate);
  strField("category_slug", null, !isUpdate);
  strField("summary", 500, false);
  strField("subtitle", 300, false);
  strField("seo_description", 140, false);
  strField("author_name", 200, false);
  strField("image_caption", 1000, false);
  strField("image_credit", 300, false);
  if (has(b, "tags") && (!Array.isArray(b.tags) || !b.tags.every(isStr))) errors.push("tags must be an array of strings");
  if (has(b, "hero_image") && (!isStr(b.hero_image) || !/^(data:image\/|https:\/\/)/i.test(b.hero_image))) {
    errors.push("hero_image must be a base64 data URL or an https URL");
  }
  if (has(b, "upsert") && typeof b.upsert !== "boolean") errors.push("upsert must be a boolean");
  if (isStr(b.category_slug) && b.category_slug.trim()) {
    const { data: cat } = await db.from("categories").select("id").eq("slug", b.category_slug).maybeSingle();
    if (!cat) errors.push(`category_slug "${b.category_slug}" does not exist`);
    else b._category_id = cat.id;
  }
  if (errors.length) return done({ error: "Validation failed", errors }, 400, "invalid");

  const row: Record<string, unknown> = {};
  const map: [string, string][] = [
    ["title", "title"], ["summary", "summary"], ["subtitle", "subtitle"], ["seo_description", "seo_description"],
    ["body", "body"], ["author_name", "author_name"], ["section", "section"], ["category_slug", "category_slug"],
    ["image_caption", "hero_image_caption"], ["image_credit", "hero_image_credit"], ["tags", "tags"],
  ];
  for (const [k, col] of map) if (has(b, k)) row[col] = b[k];
  if (b._category_id) row.category_id = b._category_id;
  if (has(b, "body")) row.word_count = String(b.body).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

  if (has(b, "hero_image")) {
    try {
      const img = await loadImage(b.hero_image);
      const ext = EXT[img.mime] || img.mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "img";
      const path = `editorial/${slug}-${Date.now().toString(36)}.${ext}`;
      const { error: upErr } = await db.storage.from("media").upload(path, img.bytes, { contentType: img.mime, upsert: false });
      if (upErr) return done({ error: "Image upload failed", detail: upErr.message }, 500, "image_upload_failed");
      row.hero_image_url = db.storage.from("media").getPublicUrl(path).data.publicUrl;
    } catch (e) {
      return done({ error: "Validation failed", errors: [`hero_image: ${(e as Error).message}`] }, 400, "image_invalid");
    }
  }

  const now = new Date().toISOString();
  if (isUpdate) {
    const { data: art, error } = await db.from("articles").update(row).eq("id", existing!.id).select("id, slug, category_slug").single();
    if (error || !art) return done({ error: "Article update failed", detail: error?.message }, 500, "update_failed");
    return done({ id: art.id, slug: art.slug, url: `https://www.statsgh.com/${art.category_slug}/${art.slug}` }, 200, "updated");
  }

  Object.assign(row, {
    slug, is_published: true, status: "published", published_at: now,
    editorial_status: "approved_editor", approved_by: "direct-publisher", approved_at: now,
  });
  const { data: art, error } = await db.from("articles").insert(row).select("id, slug, category_slug").single();
  if (error || !art) return done({ error: "Article insert failed", detail: error?.message }, 500, "insert_failed");
  return done({ id: art.id, slug: art.slug, url: `https://www.statsgh.com/${art.category_slug}/${art.slug}` }, 201, "created");
});
