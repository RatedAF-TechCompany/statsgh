import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const enc = new TextEncoder();
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
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) return Response.json({ error: "revalidation not configured" }, { status: 503 });
  const given = presentedSecret(req);
  if (!given || !(await safeEqual(given, expected))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const path = typeof body?.path === "string" ? body.path.replace(/^\/live\//, "").replace(/^\//, "") : null;
  revalidatePath("/");
  revalidatePath("/live");
  revalidatePath("/news-sitemap.xml");
  revalidatePath("/sitemaps/pages.xml");
  if (path && /^[a-z0-9-]+$/.test(path)) revalidatePath(`/live/${path}`);
  return Response.json({ revalidated: true, path: path ? `/live/${path}` : null });
}
