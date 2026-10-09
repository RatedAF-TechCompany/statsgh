// Crime gate for statsgh-x-autopost. StatsGH socials never post crime.
// Hard blocks never reach the model and have no override.

// MUST stay in sync with SECTION_TO_CATEGORIES['crime-justice'] in src/lib/sectionMapping.ts.
export const CRIME_JUSTICE_SLUGS = [
  "crime-justice", "crime", "crime-and-justice", "justice", "security-governance",
  "ghanacrimes", "courts", "security",
];
// MUST stay in sync with CRIME_JUSTICE_TAGS in src/lib/sectionMapping.ts.
export const CRIME_JUSTICE_TAGS = ["crime", "justice", "security-governance"];

const CRIME_TEXT_RE = new RegExp(
  "\\b(" + [
    "police", "arrest(?:ed|s)?", "court", "remand(?:ed)?", "murder(?:ed)?", "robbery", "robbed",
    "kidnap(?:ped|ping)?", "fraud charges?", "charged with", "sentenced", "convicted", "jailed",
    "suspects?", "galamsey arrest", "shot dead", "stabbed", "assault(?:ed)?", "rape", "prosecution",
    "prosecutor", "special prosecutor", "eoco", "manhunt", "crime",
  ].join("|") + ")\\b",
  "i",
);

export interface CrimeGateArticle {
  section?: string | null;
  category_slug?: string | null;
  tags?: string[] | null;
  editorial_category?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
}

export interface CrimeGateResult { blocked: boolean; keyword_review: boolean; reason: string }

export function crimeTextHit(text: string): boolean {
  return CRIME_TEXT_RE.test(text || "");
}

const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function crimeGate(a: CrimeGateArticle): CrimeGateResult {
  const section = lc(a.section);
  const cat = lc(a.category_slug);
  const tags = (Array.isArray(a.tags) ? a.tags : []).map(lc);
  if (section === "crime-justice") return { blocked: true, keyword_review: false, reason: "section crime-justice" };
  if (CRIME_JUSTICE_SLUGS.includes(cat)) return { blocked: true, keyword_review: false, reason: `category ${cat}` };
  // In doubt (crime-ish slug or section we do not recognise): hard-block.
  if (/crime|justice|court/.test(cat) || /crime|justice/.test(section)) {
    return { blocked: true, keyword_review: false, reason: `crime-like section/category ${section || cat}` };
  }
  const tagHit = tags.find((t) => CRIME_JUSTICE_TAGS.includes(t));
  if (tagHit) return { blocked: true, keyword_review: false, reason: `tag ${tagHit}` };
  if (lc(a.editorial_category).includes("crime")) {
    return { blocked: true, keyword_review: false, reason: "editorial_category crime" };
  }
  const bodyText = String(a.body ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).slice(0, 300).join(" ");
  const text = `${a.title ?? ""} ${a.summary ?? ""} ${bodyText}`;
  const m = text.match(CRIME_TEXT_RE);
  if (m) return { blocked: false, keyword_review: true, reason: `crime keyword "${m[1]}"` };
  return { blocked: false, keyword_review: false, reason: "" };
}
