import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import {
  accraDayBounds,
  accraMonthBounds,
  accraParts,
  addPublication,
  publicationDaysFromMap,
  type PublicationDay,
  type Ymd,
} from "@/lib/archiveDates";
import { cache } from "react";

type Sb = SupabaseClient<Database>;

const PAGE = 1000;

export const ARCHIVE_ARTICLE_COLUMNS =
  "id, title, slug, summary, hero_image_url, key_data, published_at, category_slug, section, is_sponsored, author_name";

export type ArchiveArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  hero_image_url: string | null;
  key_data: unknown;
  published_at: string | null;
  category_slug: string;
  section: string | null;
  is_sponsored: boolean;
  author_name: string | null;
};

function missingRpc(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.details ?? ""}`;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(msg) || /schema cache/i.test(msg);
}

/**
 * One row per Accra day that has published articles, newest day first.
 * Uses archive_publication_days() when the migration is applied, and otherwise
 * pages published_at on the existing (is_published, published_at) index.
 */
export async function fetchPublicationDays(sb: Sb): Promise<PublicationDay[]> {
  const rpc = await sb.rpc("archive_publication_days");
  if (!rpc.error && rpc.data) {
    return rpc.data
      .map((row) => ({
        publishedOn: String(row.published_on).slice(0, 10),
        count: Number(row.article_count),
      }))
      .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.publishedOn) && row.count > 0)
      .sort((a, b) => (a.publishedOn < b.publishedOn ? 1 : -1));
  }
  if (!missingRpc(rpc.error)) throw rpc.error;

  const map = new Map<string, { count: number; lastPublishedAt: string }>();
  for (let off = 0; off < 50_000; off += PAGE) {
    const { data, error } = await sb
      .from("articles")
      .select("published_at")
      .eq("is_published", true)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) if (row.published_at) addPublication(map, row.published_at);
    if (!data || data.length < PAGE) break;
  }
  return publicationDaysFromMap(map);
}

/** Article counts for each day of one Accra month. Range scan on published_at. */
export async function fetchMonthDayCounts(sb: Sb, year: number, month: number): Promise<{ day: number; count: number }[]> {
  const { start, end } = accraMonthBounds(year, month);
  const counts = new Map<number, number>();
  for (let off = 0; off < 20_000; off += PAGE) {
    const { data, error } = await sb
      .from("articles")
      .select("published_at")
      .eq("is_published", true)
      .gte("published_at", start)
      .lt("published_at", end)
      .order("published_at", { ascending: true })
      .order("id", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.published_at) continue;
      const day = accraParts(row.published_at).day;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    if (!data || data.length < PAGE) break;
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day - b.day);
}

export async function fetchDayArticles(sb: Sb, year: number, month: number, day: number): Promise<ArchiveArticle[]> {
  const { start, end } = accraDayBounds(year, month, day);
  const rows: ArchiveArticle[] = [];
  for (let off = 0; off < 5_000; off += PAGE) {
    const { data, error } = await sb
      .from("articles")
      .select(ARCHIVE_ARTICLE_COLUMNS)
      .eq("is_published", true)
      .gte("published_at", start)
      .lt("published_at", end)
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ArchiveArticle[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function nearestPublishedAt(sb: Sb, bound: string, direction: "before" | "after"): Promise<string | null> {
  const q = sb.from("articles").select("published_at").eq("is_published", true).not("published_at", "is", null);
  const filtered = direction === "before" ? q.lt("published_at", bound) : q.gte("published_at", bound);
  const { data, error } = await filtered
    .order("published_at", { ascending: direction === "after" })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.published_at ?? null;
}

export async function fetchAdjacentDays(sb: Sb, year: number, month: number, day: number): Promise<{ prev: Ymd | null; next: Ymd | null }> {
  const { start, end } = accraDayBounds(year, month, day);
  const [prevAt, nextAt] = await Promise.all([
    nearestPublishedAt(sb, start, "before"),
    nearestPublishedAt(sb, end, "after"),
  ]);
  return {
    prev: prevAt ? accraParts(prevAt) : null,
    next: nextAt ? accraParts(nextAt) : null,
  };
}

export async function fetchAdjacentMonths(
  sb: Sb,
  year: number,
  month: number,
): Promise<{ prev: { year: number; month: number } | null; next: { year: number; month: number } | null }> {
  const { start, end } = accraMonthBounds(year, month);
  const [prevAt, nextAt] = await Promise.all([
    nearestPublishedAt(sb, start, "before"),
    nearestPublishedAt(sb, end, "after"),
  ]);
  const toMonth = (iso: string | null) => {
    if (!iso) return null;
    const p = accraParts(iso);
    return { year: p.year, month: p.month };
  };
  return { prev: toMonth(prevAt), next: toMonth(nextAt) };
}

export const loadPublicationDays = cache(async (): Promise<{ days: PublicationDay[]; failed: boolean }> => {
  try {
    return { days: await fetchPublicationDays(createReadOnlyServerClient()), failed: false };
  } catch (error) {
    console.error("archive index", error);
    return { days: [], failed: true };
  }
});

export const loadMonth = cache(async (year: number, month: number) => {
  const sb = createReadOnlyServerClient();
  try {
    const [counts, adjacent] = await Promise.all([
      fetchMonthDayCounts(sb, year, month),
      fetchAdjacentMonths(sb, year, month),
    ]);
    return { counts, adjacent, failed: false as const };
  } catch (error) {
    console.error("archive month", error);
    return { counts: [] as { day: number; count: number }[], adjacent: { prev: null, next: null }, failed: true as const };
  }
});

export const loadDay = cache(async (year: number, month: number, day: number) => {
  const sb = createReadOnlyServerClient();
  try {
    const [articles, adjacent] = await Promise.all([
      fetchDayArticles(sb, year, month, day),
      fetchAdjacentDays(sb, year, month, day),
    ]);
    return { articles, adjacent, failed: false as const };
  } catch (error) {
    console.error("archive day", error);
    return { articles: [] as ArchiveArticle[], adjacent: { prev: null, next: null }, failed: true as const };
  }
});
