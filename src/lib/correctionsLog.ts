// Public corrections log. Every correction published on a story (story_updates, kind = 'correction')
// plus any entry in the older `corrections` table, newest first. Shared by the server prefetch and the
// client view so /corrections renders the full log in its first HTML.
import { supabase } from "@/integrations/supabase/client";

export type CorrectionEntry = {
  id: string;
  date: string;
  articleTitle: string;
  articleUrl: string;
  wrong: string | null;
  fixed: string | null;
  summary: string | null;
  material: boolean | null;
};

export async function fetchCorrectionsLog(): Promise<CorrectionEntry[]> {
  const [legacy, su] = await Promise.all([
    supabase.from("corrections").select("id, article_title, article_url, what_was_wrong, what_was_fixed, corrected_at").order("corrected_at", { ascending: false }),
    supabase.from("story_updates").select("id, article_id, posted_at, summary, is_material").eq("kind", "correction").order("posted_at", { ascending: false }).limit(500),
  ]);
  if (legacy.error && su.error) throw su.error;
  const rows = (su.data ?? []) as { id: string; article_id: string; posted_at: string; summary: string | null; is_material: boolean | null }[];
  const ids = [...new Set(rows.map((r) => r.article_id))];
  const arts = new Map<string, { title: string; slug: string; category_slug: string }>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("articles").select("id, title, slug, category_slug").in("id", ids.slice(i, i + 100)).eq("is_published", true);
    for (const a of (data ?? []) as { id: string; title: string; slug: string; category_slug: string }[]) arts.set(a.id, a);
  }
  const out: CorrectionEntry[] = [];
  for (const r of rows) {
    const a = arts.get(r.article_id);
    if (!a) continue; // unpublished article: not shown
    out.push({ id: r.id, date: r.posted_at, articleTitle: a.title, articleUrl: `/${a.category_slug}/${a.slug}`, wrong: null, fixed: null, summary: r.summary, material: r.is_material });
  }
  for (const c of (legacy.data ?? []) as { id: string; article_title: string; article_url: string; what_was_wrong: string; what_was_fixed: string; corrected_at: string }[]) {
    out.push({ id: c.id, date: c.corrected_at, articleTitle: c.article_title, articleUrl: c.article_url, wrong: c.what_was_wrong, fixed: c.what_was_fixed, summary: null, material: null });
  }
  return out.sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0));
}
