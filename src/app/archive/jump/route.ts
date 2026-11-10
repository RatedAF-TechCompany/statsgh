import { isRealCalendarDate, pad2 } from "@/lib/archiveDates";

export const dynamic = "force-dynamic";

// The archive date form posts here so /archive itself can stay cached.
// A real calendar date redirects to its canonical day page.
export function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const year = match ? Number(match[1]) : NaN;
  const month = match ? Number(match[2]) : NaN;
  const day = match ? Number(match[3]) : NaN;
  const ok = match && year >= 2000 && year <= 2100 && isRealCalendarDate(year, month, day);
  const location = ok ? `/archive/${year}/${pad2(month)}/${pad2(day)}` : "/archive";
  return new Response(null, {
    status: ok ? 301 : 302,
    headers: {
      Location: location,
      "X-Robots-Tag": "noindex",
      "Cache-Control": ok ? "public, max-age=86400" : "no-store",
    },
  });
}
