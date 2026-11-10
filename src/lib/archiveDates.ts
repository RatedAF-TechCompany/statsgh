// Publication dates for the public archive. Africa/Accra is GMT (UTC+0) year-round.

export const ARCHIVE_TZ = "Africa/Accra";
export const ARCHIVE_YEAR_MIN = 2000;
export const ARCHIVE_YEAR_MAX = 2100;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export { WEEKDAYS as ARCHIVE_WEEKDAYS };

export const pad2 = (n: number) => String(n).padStart(2, "0");

export const archiveMonthPath = (year: number, month: number) => `/archive/${year}/${pad2(month)}`;
export const archiveDayPath = (year: number, month: number, day: number) =>
  `/archive/${year}/${pad2(month)}/${pad2(day)}`;

export type Ymd = { year: number; month: number; day: number };

export type PublicationDay = {
  /** YYYY-MM-DD in Africa/Accra. */
  publishedOn: string;
  count: number;
  /** Newest published_at that fell on this Accra day, when known. */
  lastPublishedAt?: string;
};

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const raw = parts.find((p) => p.type === type)?.value ?? "";
  return Number(raw === "24" ? "0" : raw);
}

/** Calendar fields of an absolute instant in Africa/Accra. */
export function accraParts(iso: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ARCHIVE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return { year: part(parts, "year"), month: part(parts, "month"), day: part(parts, "day") };
}

export function accraDateKey(iso: string): string {
  const p = accraParts(iso);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function accraToday(now = new Date()): Ymd {
  return accraParts(now.toISOString());
}

/** Offset of `timeZone` at `instant`, in milliseconds (Accra is 0). */
function tzOffsetMs(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const asUtc = Date.UTC(part(parts, "year"), part(parts, "month") - 1, part(parts, "day"), part(parts, "hour"), part(parts, "minute"), part(parts, "second"));
  return asUtc - instant.getTime();
}

/** UTC instants of Accra midnight at the start of this calendar day and the next one. */
export function accraDayBounds(year: number, month: number, day: number): { start: string; end: string } {
  const startGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endGuess = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const start = new Date(startGuess.getTime() - tzOffsetMs(ARCHIVE_TZ, startGuess));
  const end = new Date(endGuess.getTime() - tzOffsetMs(ARCHIVE_TZ, endGuess));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function accraMonthBounds(year: number, month: number): { start: string; end: string } {
  const start = accraDayBounds(year, month, 1).start;
  const end = month === 12 ? accraDayBounds(year + 1, 1, 1).start : accraDayBounds(year, month + 1, 1).start;
  return { start, end };
}

export function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function parseYear(year: string): number | null {
  if (!/^\d{4}$/.test(year)) return null;
  const y = Number(year);
  if (y < ARCHIVE_YEAR_MIN || y > ARCHIVE_YEAR_MAX) return null;
  return y;
}

function parseMonthNum(month: string): number | null {
  if (!/^\d{1,2}$/.test(month)) return null;
  const m = Number(month);
  if (m < 1 || m > 12) return null;
  return m;
}

export function parseMonthRoute(year: string, month: string): { year: number; month: number } | null {
  const y = parseYear(year);
  const m = parseMonthNum(month);
  if (y == null || m == null) return null;
  return { year: y, month: m };
}

export function parseDayRoute(year: string, month: string, day: string): Ymd | null {
  const base = parseMonthRoute(year, month);
  if (!base || !/^\d{1,2}$/.test(day)) return null;
  const d = Number(day);
  if (!isRealCalendarDate(base.year, base.month, d)) return null;
  return { year: base.year, month: base.month, day: d };
}

/** "1 January 2026", or "January 2026" when the day is omitted. */
export function formatLongDate(year: number, month: number, day?: number): string {
  const date = new Date(Date.UTC(year, month - 1, day ?? 1, 12));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    ...(day ? { day: "numeric" as const } : {}),
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatMonthName(month: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(new Date(Date.UTC(2026, month - 1, 1, 12)));
}

/** Clock time in Accra, 24-hour, without a timezone suffix. */
export function formatAccraTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ARCHIVE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function articleCountLabel(n: number): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? "article" : "articles"}`;
}

export function addPublication(map: Map<string, { count: number; lastPublishedAt: string }>, iso: string) {
  const key = accraDateKey(iso);
  const cur = map.get(key);
  if (!cur) {
    map.set(key, { count: 1, lastPublishedAt: iso });
    return;
  }
  cur.count += 1;
  if (Date.parse(iso) > Date.parse(cur.lastPublishedAt)) cur.lastPublishedAt = iso;
}

export function publicationDaysFromMap(map: Map<string, { count: number; lastPublishedAt: string }>): PublicationDay[] {
  return [...map.entries()]
    .map(([publishedOn, v]) => ({ publishedOn, count: v.count, lastPublishedAt: v.lastPublishedAt }))
    .sort((a, b) => (a.publishedOn < b.publishedOn ? 1 : -1));
}

export function accumulatePublicationDays(rows: { published_at: string | null }[]): PublicationDay[] {
  const map = new Map<string, { count: number; lastPublishedAt: string }>();
  for (const row of rows) if (row.published_at) addPublication(map, row.published_at);
  return publicationDaysFromMap(map);
}

export type YearGroup = {
  year: number;
  count: number;
  months: { month: number; count: number }[];
};

export function groupDaysByYear(days: Pick<PublicationDay, "publishedOn" | "count">[]): YearGroup[] {
  const years = new Map<number, Map<number, number>>();
  for (const d of days) {
    const [ys, ms] = d.publishedOn.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y)!;
    months.set(m, (months.get(m) ?? 0) + d.count);
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      count: [...months.values()].reduce((sum, n) => sum + n, 0),
      months: [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, count]) => ({ month, count })),
    }));
}

/** Monday-first month grid. Null cells are the leading and trailing blanks. */
export function monthGrid(year: number, month: number): ({ day: number } | null)[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const pad = (firstDow + 6) % 7;
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: ({ day: number } | null)[] = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= n; d++) cells.push({ day: d });
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function ymdKey(p: Ymd): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}
