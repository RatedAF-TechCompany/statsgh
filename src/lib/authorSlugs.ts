// Bylines (Zeb, Nov 2026): each article carries the byline in articles.author_name.
// Staff journalists (real individuals, Zeb 15 Nov 2026) and the Research Editor have their own profile pages; sweep-written
// and unattributed pieces keep the in-house byline, Abubakar Saddique.
export type Byline = { name: string; slug: string; role: string };

export const DEFAULT_BYLINE: Byline = { name: "Abubakar Saddique", slug: "abubakar-saddique", role: "Data journalist" };

export const DESK_BYLINES: Byline[] = [
  { name: "Samuel Sackey", slug: "samuel-sackey", role: "Journalist, macro and public finance" },
  { name: "Akorfa Abotsigah", slug: "akorfa-abotsigah", role: "Journalist, markets and banking" },
  { name: "Elsie Osei", slug: "elsie-osei", role: "Journalist, business, resources and deals" },
  { name: "Josie Mensah", slug: "josie-mensah", role: "Journalist, data investigations and accountability" },
  { name: "Kofi Amoah", slug: "kofi-amoah", role: "Journalist, explainers and household economy" },
  { name: "Ama Owusu", slug: "ama-owusu", role: "Journalist, social trends" },
];

export const RESEARCH_BYLINE: Byline = { name: "Zebrilla Najib", slug: "zebrilla-najib", role: "Research Editor" };

// Contributors with a profile page whose pieces run under another byline (house rules: Yaw's
// thesis-to-news pieces carry the Research Editor's byline).
export const CONTRIBUTOR_BYLINES: Byline[] = [
  { name: "Yaw Bosompim", slug: "yaw-bosompim", role: "Thesis-to-News" },
];

const BY_NAME = new Map<string, Byline>(
  [DEFAULT_BYLINE, RESEARCH_BYLINE, ...DESK_BYLINES, ...CONTRIBUTOR_BYLINES].map((b) => [b.name.toLowerCase(), b]),
);

/** Byline for an article's author_name. Unknown or empty names fall back to the in-house byline. */
export function bylineFor(authorName: string | null | undefined): Byline {
  return BY_NAME.get((authorName || "").trim().toLowerCase()) ?? DEFAULT_BYLINE;
}

// Author profiles that render their own page. Every other /authors/<slug> 301s to the
// in-house byline (worker-entry.ts), so only these may appear in the sitemap.
export const PUBLIC_AUTHOR_SLUGS = [
  "abubakar-saddique", "hawa-kokonu", "zebrilla-najib",
  ...DESK_BYLINES.map((b) => b.slug),
  ...CONTRIBUTOR_BYLINES.map((b) => b.slug),
] as const;
export const DEFAULT_AUTHOR_SLUG = DEFAULT_BYLINE.slug;
