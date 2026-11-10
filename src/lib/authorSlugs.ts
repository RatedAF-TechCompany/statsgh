// Author profiles that render their own page. Every other /authors/<slug> 301s to the
// in-house byline (worker-entry.ts), so only these may appear in the sitemap.
export const PUBLIC_AUTHOR_SLUGS = ["abubakar-saddique", "hawa-kokonu", "zebrilla-najib"] as const;
export const DEFAULT_AUTHOR_SLUG = "abubakar-saddique";
