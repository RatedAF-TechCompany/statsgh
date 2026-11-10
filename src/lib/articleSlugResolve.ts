// Resolve a mistyped/mangled article slug to the SAME published story, or nothing.
// Never guesses a different story: only exact matches after normalisation, after
// ignoring hyphenation, or after restoring the trailing 8-character ID suffix, and
// only when exactly one published story matches.
import { createReadOnlyServerClient } from "@/lib/supabase/server";

const PAGE = 1000;

export function normaliseSlug(raw: string): string {
  let s = raw;
  try { s = decodeURIComponent(s); } catch {}
  return s
    .toLowerCase()
    .replace(/\.(html?|php|aspx?)$/, "")
    .replace(/[\s_+.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

const squash = (s: string) => s.replace(/[^a-z0-9]/g, "");
const ID_SUFFIX = /^(.*)-(?=[a-z]*[0-9])[a-z0-9]{8}$/; // generated IDs always contain a digit

export async function resolveArticleSlug(raw: string): Promise<{ slug: string; category_slug: string } | null> {
  const want = normaliseSlug(raw);
  if (!want || want.length < 8) return null;
  const sb = createReadOnlyServerClient();
  const rows: { slug: string; category_slug: string }[] = [];
  for (let off = 0; off < 50_000; off += PAGE) {
    const { data, error } = await sb.from("articles").select("slug, category_slug").eq("is_published", true)
      .order("id", { ascending: true }).range(off, off + PAGE - 1);
    if (error) return null;
    rows.push(...((data ?? []) as any[]));
    if (!data || data.length < PAGE) break;
  }
  const pick = (hits: typeof rows) => (hits.length === 1 ? hits[0] : null);
  const exact = pick(rows.filter((r) => r.slug === want));
  if (exact) return exact;
  const w = squash(want);
  const hyphen = pick(rows.filter((r) => squash(r.slug) === w));
  if (hyphen) return hyphen;
  // Link copied without the trailing ID suffix (e.g. ".../traffitech-fines-...-target" for "...-target-mw187mwd").
  return pick(rows.filter((r) => { const m = ID_SUFFIX.exec(r.slug); return !!m && squash(m[1]) === w; }));
}
