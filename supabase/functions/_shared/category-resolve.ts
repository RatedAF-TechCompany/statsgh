// Publish-time category resolver. Rules:
//  - crime/court/police stories go ONLY to "crime-justice" and can never fall
//    through to a data category;
//  - everything else must end on a known slug (never empty).
import { CRIME_JUSTICE_SLUGS, CRIME_JUSTICE_TAGS } from "./crime-gate.ts";

export const CRIME_CATEGORY = "crime-justice";

// Strong signals: a single one in the headline is enough.
const STRONG_RE = new RegExp(
  "\\b(" + [
    "police", "arrest(?:ed|s)?", "remand(?:ed)?", "murder(?:ed|s)?", "robbery", "robbed", "kidnap(?:ped|ping)?",
    "charged with", "sentenced", "convicted", "jailed", "suspects?", "shot dead", "stabbed", "assault(?:ed)?",
    "rape[ds]?", "manhunt", "crime", "criminal", "homicide", "trafficking",
  ].join("|") + ")\\b", "gi",
);
// Weak signals ("court", "prosecution" ...) only count in the headline, and only with another signal.
const WEAK_RE = /\b(court|prosecut(?:ion|or|ors|ed)|special prosecutor|eoco|fraud|trial|judge)\b/gi;

const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const hits = (re: RegExp, text: string) => new Set((text.match(re) || []).map((m) => m.toLowerCase()));

export interface CategoryInput {
  category_slug?: string | null; section?: string | null; tags?: string[] | null;
  editorial_category?: string | null; title?: string | null; summary?: string | null; body?: string | null;
}

export function isCrimeStory(a: CategoryInput): boolean {
  const cat = lc(a.category_slug), section = lc(a.section);
  if (CRIME_JUSTICE_SLUGS.includes(cat) || /crime|justice/.test(cat) || /crime|justice/.test(section)) return true;
  if ((a.tags || []).map(lc).some((t) => CRIME_JUSTICE_TAGS.includes(t))) return true;
  if (lc(a.editorial_category).includes("crime")) return true;
  const title = String(a.title ?? "");
  const tStrong = hits(STRONG_RE, title), tWeak = hits(WEAK_RE, title);
  if (tStrong.size >= 1) return true;
  if (tWeak.size >= 2) return true;
  // Story text: need several distinct strong signals, so a business story that
  // mentions a court case or a prosecution in passing is not pulled in.
  const body = String(a.body ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).slice(0, 400).join(" ");
  const textStrong = hits(STRONG_RE, `${a.summary ?? ""} ${body}`);
  if (tWeak.size >= 1 && textStrong.size >= 2) return true;
  return textStrong.size >= 3;
}

export function resolveCategorySlug(a: CategoryInput, allowed: readonly string[], fallback: string): string {
  if (isCrimeStory(a)) return CRIME_CATEGORY;
  const cat = lc(a.category_slug);
  return allowed.includes(cat) ? cat : fallback;
}
