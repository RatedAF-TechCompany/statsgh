// Canonical hosts for source links. bog.gov.gh (no www) fails TLS for many clients; www.bog.gov.gh works,
// and is what the rest of the site links. Applied wherever data_sources.website_url is shown.
const HOST_FIXES: [RegExp, string][] = [[/^https?:\/\/bog\.gov\.gh(?=\/|$)/i, "https://www.bog.gov.gh"]];

export function canonicalSourceUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  return HOST_FIXES.reduce((u, [re, to]) => u.replace(re, to), String(url));
}

export function withCanonicalSourceUrls<T extends { website_url?: string | null }>(rows: T[]): T[] {
  return rows.map((r) => (r?.website_url ? { ...r, website_url: canonicalSourceUrl(r.website_url) } : r));
}
