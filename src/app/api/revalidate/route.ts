import { revalidatePath } from "next/cache";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { accraParts, archiveDayPath, archiveMonthPath } from "@/lib/archiveDates";
import { pingIndexNow } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

// Called by a database trigger when an article is published or updated.
// It only refreshes cached pages for a real published article looked up by id,
// so the caller cannot choose arbitrary paths. Requires the shared secret in
// REVALIDATE_SECRET, sent as `x-revalidate-secret` or `Authorization: Bearer`.
const enc = new TextEncoder();

/** Constant-time comparison: hash both sides to fixed-length digests, then XOR every byte. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da), y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function presentedSecret(req: Request): string {
  const header = req.headers.get("x-revalidate-secret");
  if (header) return header;
  const auth = req.headers.get("authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export async function POST(req: Request) {
  // Fail closed: without REVALIDATE_SECRET configured nobody can call this.
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) return Response.json({ error: "revalidation not configured" }, { status: 503 });
  const given = presentedSecret(req);
  if (!given || !(await safeEqual(given, expected))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const { data } = await createReadOnlyServerClient().from("articles")
    .select("slug, category_slug, published_at").eq("id", id).eq("is_published", true).maybeSingle();
  const archive = ["/archive"];
  if (data?.published_at) {
    const published = accraParts(data.published_at);
    archive.push(archiveMonthPath(published.year, published.month), archiveDayPath(published.year, published.month, published.day));
  }
  revalidatePath("/");
  revalidatePath("/news-sitemap.xml");
  revalidatePath("/sitemap.xml");
  revalidatePath("/sitemaps/pages.xml");
  for (const path of archive) revalidatePath(path);
  if (data) {
    revalidatePath(`/${data.category_slug}`);
    revalidatePath(`/${data.category_slug}/${data.slug}`);
    const urls = [`https://www.statsgh.com/${data.category_slug}/${data.slug}`];
    if (data.published_at) urls.push(`https://www.statsgh.com${archive[archive.length - 1]}`);
    await pingIndexNow(urls);
  }
  return Response.json({ revalidated: true, article: data ? `/${data.category_slug}/${data.slug}` : null, archive });
}
