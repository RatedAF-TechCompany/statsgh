import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadMonth } from "@/lib/archive";
import { archiveMetadata, collectionLd, monthNavEnds } from "@/lib/archiveMeta";
import {
  archiveMonthPath,
  articleCountLabel,
  formatLongDate,
  pad2,
  parseMonthRoute,
} from "@/lib/archiveDates";
import {
  AdjacentNav,
  ArchiveCrumbs,
  ArchiveHeading,
  ArchiveJump,
  JsonLd,
  MonthCalendar,
  MonthDayList,
} from "@/components/archive/ArchiveUi";

export const revalidate = 120;

interface Props {
  params: Promise<{ year: string; month: string }>;
}

function resolveMonth(year: string, month: string) {
  const parsed = parseMonthRoute(year, month);
  if (!parsed) notFound();
  if (month !== pad2(parsed.month)) permanentRedirect(archiveMonthPath(parsed.year, parsed.month));
  return parsed;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year: ys, month: ms } = await params;
  const { year, month } = resolveMonth(ys, ms);
  const loaded = await loadMonth(year, month);
  const label = formatLongDate(year, month);
  const total = loaded.counts.reduce((sum, row) => sum + row.count, 0);
  const title = `StatsGH news archive: ${label}`;
  const description = loaded.failed
    ? `The StatsGH archive for ${label} is temporarily unavailable.`
    : total
      ? `StatsGH articles published in ${label}, listed by day. ${articleCountLabel(total)}.`
      : `No StatsGH articles were published in ${label}.`;
  return archiveMetadata(archiveMonthPath(year, month), title, description, !loaded.failed && total > 0);
}

export default async function ArchiveMonthPage({ params }: Props) {
  const { year: ys, month: ms } = await params;
  const { year, month } = resolveMonth(ys, ms);
  const loaded = await loadMonth(year, month);
  const label = formatLongDate(year, month);
  const total = loaded.counts.reduce((sum, row) => sum + row.count, 0);
  const path = archiveMonthPath(year, month);
  const title = `StatsGH news archive: ${label}`;
  const description = total
    ? `${articleCountLabel(total)} published in ${label}. Choose a day to read that day's stories.`
    : `No articles were published in ${label}.`;
  const lede = loaded.failed ? "The archive is temporarily unavailable. Please try again in a few minutes." : description;
  const countMap = new Map(loaded.counts.map((row) => [row.day, row.count]));
  const ends = monthNavEnds(loaded.adjacent.prev, loaded.adjacent.next);
  const today = `${year}-${pad2(month)}-01`;

  return (
    <>
      {!loaded.failed && <JsonLd data={collectionLd({
        path,
        name: title,
        description,
        crumbs: [
          { path: "/archive", label: "Archive" },
          { path, label },
        ],
      })} />}
      <ArchiveCrumbs items={[{ href: "/archive", label: "Archive" }, { label }]} />
      <ArchiveHeading kicker="Archive" title={label} lede={lede} />
      <ArchiveJump defaultDate={today} />
      <MonthCalendar year={year} month={month} counts={countMap} />
      <MonthDayList year={year} month={month} counts={loaded.counts} />
      <AdjacentNav kind="month" prev={ends.prev} next={ends.next} />
    </>
  );
}
