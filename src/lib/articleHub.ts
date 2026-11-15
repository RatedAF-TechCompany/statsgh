// Article hub data (Budget, Elections, Explainers, Claims vs data). No "use client": the same fetcher runs on the
// server (SSR prefetch, so crawlers see the story list) and in the browser.
import { supabase } from "@/integrations/supabase/client";
import { ilikeOr } from "@/lib/postgrest-filter";

export type HubArticle = { id: string; title: string; slug: string; category_slug: string | null; summary: string | null; published_at: string | null };
export type HubSpec = { tags: string[]; titleTerms: string[] };

export const HUBS = {
  explainers: { tags: ["explainer", "explainers", "explain-this-number"], titleTerms: ["explainer", "explained", "what is ", "what are ", "how does ", "why does "] },
  factCheck: { tags: ["fact-check", "factcheck", "claims-vs-data"], titleTerms: ["fact-check", "fact check", "claims vs data", "claim:"] },
  elections: { tags: ["election", "elections", "electoral-commission"], titleTerms: ["election", "electoral", "polling station", "voter register", "presidential primaries", "parliamentary primaries"] },
  budget: { tags: ["budget", "mid-year-review", "public-debt", "imf"], titleTerms: ["budget", "mid-year review", "public debt", "fiscal", "debt restructuring"] },
} satisfies Record<string, HubSpec>;

export const hubQueryKey = ({ tags, titleTerms }: HubSpec) => ["hub", tags.join(","), titleTerms.join(",")] as const;

export async function fetchHub({ tags, titleTerms }: HubSpec): Promise<{ rows: HubArticle[]; counts: Record<string, number> }> {
  const ors = [...titleTerms.map((t) => ilikeOr(["title"], t)), tags.length ? `tags.ov.{${tags.join(",")}}` : ""].filter(Boolean).join(",");
  const { data, error } = await supabase.from("articles").select("id,title,slug,category_slug,summary,published_at")
    .eq("is_published", true).or(ors).order("published_at", { ascending: false }).limit(60);
  if (error) throw error;
  const rows = (data || []) as HubArticle[];
  const counts: Record<string, number> = {};
  if (rows.length) {
    const { data: ups } = await (supabase as any).from("story_updates").select("article_id").in("article_id", rows.map((r) => r.id));
    for (const u of ups || []) counts[u.article_id] = (counts[u.article_id] || 0) + 1;
  }
  return { rows, counts };
}

export const hubPrefetch = (spec: HubSpec) => ({ queryKey: [...hubQueryKey(spec)], queryFn: () => fetchHub(spec) });
