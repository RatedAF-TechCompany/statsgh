import type { Metadata } from "next";
import Link from "next/link";
import { loadPublicationDays } from "@/lib/archive";
import { archiveMetadata, collectionLd } from "@/lib/archiveMeta";
import { archiveMonthPath, articleCountLabel, formatMonthName, groupDaysByYear } from "@/lib/archiveDates";
import { ArchiveHeading, ArchiveJump, JsonLd } from "@/components/archive/ArchiveUi";

export const revalidate = 120;

const PATH = "/archive";
const TITLE = "StatsGH news archive";
const DESCRIPTION = "Browse every StatsGH article by the day it was published. Dates use Ghana time (GMT).";

export async function generateMetadata(): Promise<Metadata> {
  const { failed, days } = await loadPublicationDays();
  const description = failed ? "The StatsGH news archive is temporarily unavailable." : DESCRIPTION;
  return archiveMetadata(PATH, TITLE, description, !failed && days.length > 0);
}

export default async function ArchiveIndexPage() {
  const { days, failed } = await loadPublicationDays();
  const years = groupDaysByYear(days);
  const total = years.reduce((sum, year) => sum + year.count, 0);
  const lede = failed
    ? "The archive is temporarily unavailable. Please try again in a few minutes."
    : days.length
      ? `${articleCountLabel(total)}, grouped by month. Each date is the day the story was published in Ghana (GMT).`
      : "No articles have been published yet.";

  return (
    <>
      {!failed && days.length > 0 && <JsonLd data={collectionLd({
        path: PATH,
        name: TITLE,
        description: DESCRIPTION,
        crumbs: [{ path: PATH, label: "Archive" }],
      })} />}
      <ArchiveHeading kicker="Archive" title="News archive" lede={lede} />
      <ArchiveJump />
      {years.map((year) => (
        <section key={year.year} className="mt-10">
          <div className="flex items-baseline justify-between gap-4 border-b border-[#D9D9D9] pb-2">
            <h2 className="font-headline text-[28px] font-bold text-[#0D0D0D]">{year.year}</h2>
            <p className="font-ui text-[13px] text-[#5B5B5B]">{articleCountLabel(year.count)}</p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {year.months.map((month) => (
              <li key={month.month}>
                <Link
                  href={archiveMonthPath(year.year, month.month)}
                  className="block border border-[#D9D9D9] px-4 py-3 hover:border-[#E3120B]"
                >
                  <span className="block font-headline text-[18px] font-bold text-[#0D0D0D]">{formatMonthName(month.month)}</span>
                  <span className="font-ui text-[12px] text-[#5B5B5B]">{articleCountLabel(month.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
