/** /live/<slug>-YYYY-MM-DD — the date is always the last -YYYY-MM-DD, so slugs may contain hyphens. */

const DATE = /^(\d{4}-\d{2}-\d{2})$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d{4}-\d{2}-\d{2})$/;

export function isLiveSlug(slug: string): boolean {
  return SLUG.test(slug) && !DATE.test(slug);
}

export function isLiveDate(date: string): boolean {
  if (!DATE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function pagePath(slug: string, date: string): string {
  return `${slug}-${date}`;
}

export function parseLivePath(path: string): { slug: string; date: string } | null {
  const m = PATH.exec(path);
  if (!m || !isLiveDate(m[2])) return null;
  return { slug: m[1], date: m[2] };
}

/** Today in Africa/Accra (GMT all year), YYYY-MM-DD. */
export function todayAccraDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function liveUrl(path: string): string {
  return `https://www.statsgh.com/live/${path}`;
}
