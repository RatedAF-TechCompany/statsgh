/** Display instants in GMT, which is Africa/Accra all year (same zone). */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): { y: number; mon: string; d: number; hh: string; mm: string } {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { y: 0, mon: "Jan", d: 0, hh: "00", mm: "00" };
  return {
    y: dt.getUTCFullYear(),
    mon: MONTHS[dt.getUTCMonth()],
    d: dt.getUTCDate(),
    hh: String(dt.getUTCHours()).padStart(2, "0"),
    mm: String(dt.getUTCMinutes()).padStart(2, "0"),
  };
}

/** e.g. "13 Nov 2026, 22:15 GMT" */
export function formatGmt(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${p.mon} ${p.y}, ${p.hh}:${p.mm} GMT`;
}

/** e.g. "22:15 GMT" on the same UTC day as `now`, otherwise the full stamp. */
export function formatGmtShort(iso: string, now = new Date()): string {
  const dt = new Date(iso);
  const p = parts(iso);
  const sameDay = dt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  return sameDay ? `${p.hh}:${p.mm} GMT` : formatGmt(iso);
}

/** Client-relative "Updated X minutes ago". Pure, so it can be unit-tested. */
export function formatUpdatedAgo(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Updated just now";
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes === 1) return "Updated 1 minute ago";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "Updated 1 hour ago";
  if (hours < 48) return `Updated ${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}
