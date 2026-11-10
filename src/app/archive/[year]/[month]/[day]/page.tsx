import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadDay } from "@/lib/archive";
import { archiveMetadata, collectionLd, dayNavEnds } from "@/lib/archiveMeta";
import {
  archiveDayPath,
  archiveMonthPath,
  articleCountLabel,
  formatLongDate,
  pad2,
  parseDayRoute,
} from "@/lib/archiveDates";
import {
  AdjacentNav,
  ArchiveCrumbs,
  ArchiveHeading,
  ArchiveJump,
  DayArticleList,
  JsonLd,
} from "@/components/archive/ArchiveUi";

export const revalidate = 120;

interface Props {
  params: Promise<{ year: string; month: string; day: string }>;
}

function resolveDay(year: string, month: string, day: string) {
  const parsed = parseDayRoute(year, month, day);
  if (!parsed) notFound();
  if (month !== pad2(parsed.month) || day !== pad2(parsed.day)) {
    permanentRedirect(archiveDayPath(parsed.year, parsed.month, parsed.day));
  }
  return parsed;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year: ys, month: ms, day: ds } = await params;
  const parsed = resolveDay(ys, ms, ds);
  const loaded = await loadDay(parsed.year, parsed.month, parsed.day);
  const label = formatLongDate(parsed.year, parsed.month, parsed.day);
  const title = `StatsGH news archive: ${label}`;
  const n = loaded.articles.length;
  const description = loaded.failed
    ? `The StatsGH archive for ${label} is temporarily unavailable.`
    : n
      ? `Every StatsGH article published on ${label}, newest first. ${articleCountLabel(n)}.`
      : `No StatsGH articles were published on ${label}.`;
  return archiveMetadata(archiveDayPath(parsed.year, parsed.month, parsed.day), title, description, !loaded.failed && n > 0);
}

export default async function ArchiveDayPage({ params }: Props) {
  const { year: ys, month: ms, day: ds } = await params;
  const parsed = resolveDay(ys, ms, ds);
  const loaded = await loadDay(parsed.year, parsed.month, parsed.day);
  const label = formatLongDate(parsed.year, parsed.month, parsed.day);
  const monthLabel = formatLongDate(parsed.year, parsed.month);
  const path = archiveDayPath(parsed.year, parsed.month, parsed.day);
  const monthPath = archiveMonthPath(parsed.year, parsed.month);
  const title = `StatsGH news archive: ${label}`;
  const n = loaded.articles.length;
  const description = n
    ? `${articleCountLabel(n)} published on ${label}, newest first. Times are Ghana time (GMT).`
    : `No articles were published on ${label}.`;
  const lede = loaded.failed ? "The archive is temporarily unavailable. Please try again in a few minutes." : description;
  const ends = dayNavEnds(loaded.adjacent.prev, loaded.adjacent.next);

  return (
    <>
      {!loaded.failed && <JsonLd data={collectionLd({
        path,
        name: title,
        description,
        crumbs: [
          { path: "/archive", label: "Archive" },
          { path: monthPath, label: monthLabel },
          { path, label },
        ],
        articles: loaded.articles.map((article) => ({
          path: `/${article.category_slug}/${article.slug}`,
          name: article.title,
        })),
      })} />}
      <ArchiveCrumbs
        items={[
          { href: "/archive", label: "Archive" },
          { href: monthPath, label: monthLabel },
          { label },
        ]}
      />
      <ArchiveHeading kicker="Archive" title={label} lede={lede} />
      <ArchiveJump defaultDate={`${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`} />
      {n > 0 && <DayArticleList articles={loaded.articles} />}
      <AdjacentNav kind="day" prev={ends.prev} next={ends.next} />
    </>
  );
}
