import Link from "next/link";
import { ArticleImage } from "@/components/SiteTile";
import { CATEGORY_MAPPING } from "@/lib/navigation";
import {
  accraToday,
  ARCHIVE_WEEKDAYS,
  archiveDayPath,
  articleCountLabel,
  formatAccraTime,
  formatLongDate,
  monthGrid,
  pad2,
} from "@/lib/archiveDates";
import type { ArchiveArticle } from "@/lib/archive";

export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function ArchiveJump({ defaultDate }: { defaultDate?: string }) {
  const today = accraToday();
  const max = `${today.year}-${pad2(today.month)}-${pad2(today.day)}`;
  return (
    <form action="/archive/jump" method="get" className="mt-6 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="archive-date" className="mb-1 block font-ui text-[12px] font-semibold text-[#5B5B5B]">
          Pick a date
        </label>
        <input
          id="archive-date"
          type="date"
          name="date"
          required
          min="2020-01-01"
          max={max}
          defaultValue={defaultDate}
          className="h-10 border border-[#D9D9D9] bg-white px-2 font-ui text-[14px] text-[#0D0D0D]"
        />
      </div>
      <button type="submit" className="h-10 bg-[#E3120B] px-4 font-ui text-[13px] font-semibold text-white hover:bg-[#B30E08]">
        Show this day
      </button>
    </form>
  );
}

export function ArchiveHeading({ kicker, title, lede }: { kicker: string; title: string; lede: string }) {
  return (
    <header className="border-b border-[#E3120B] pb-3">
      <p className="section-label">{kicker}</p>
      <h1 className="mt-2 font-headline text-[32px] font-bold leading-tight text-[#0D0D0D] md:text-[40px]">{title}</h1>
      <p className="mt-2 max-w-3xl font-serif text-[15px] leading-relaxed text-[#5B5B5B]">{lede}</p>
    </header>
  );
}

type Crumb = { href?: string; label: string };

export function ArchiveCrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 font-ui text-[13px] text-[#5B5B5B]">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-[#E3120B]">
                {item.label}
              </Link>
            ) : (
              <span className="text-[#0D0D0D]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function categoryLabel(slug: string): string {
  return CATEGORY_MAPPING[slug as keyof typeof CATEGORY_MAPPING] || slug.replace(/-/g, " ");
}

export function DayArticleList({ articles }: { articles: ArchiveArticle[] }) {
  return (
    <ol className="mt-2 border-t border-[#D9D9D9]">
      {articles.map((article) => {
        const href = `/${article.category_slug}/${article.slug}`;
        return (
          <li key={article.id} className="border-b border-[#D9D9D9]">
            <Link href={href} className="group flex gap-3 py-4 sm:gap-5 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="font-ui text-[12px] font-semibold text-[#E3120B]">{categoryLabel(article.category_slug)}</p>
                {article.is_sponsored && (
                  <p className="mt-1 inline-block bg-[#B8860B] px-1.5 py-0.5 font-ui text-[10px] font-bold uppercase tracking-wider text-white">
                    Sponsored
                  </p>
                )}
                <h2 className="mt-1 font-headline text-[18px] font-bold leading-snug text-[#0D0D0D] group-hover:text-[#E3120B] sm:text-[22px]">
                  {article.title}
                </h2>
                {article.summary && (
                  <p className="mt-1 line-clamp-3 font-serif text-[15px] leading-relaxed text-[#5B5B5B]">{article.summary}</p>
                )}
                <p className="mt-2 font-ui text-[12px] text-[#757575]">
                  {article.published_at && (
                    <time dateTime={article.published_at}>{`${formatAccraTime(article.published_at)} GMT`}</time>
                  )}
                  {article.author_name && (
                    <span>
                      {article.published_at ? " · " : ""}
                      {article.author_name}
                    </span>
                  )}
                </p>
              </div>
              {article.hero_image_url && (
                <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden sm:h-[84px] sm:w-[126px]">
                  <ArticleImage article={article} size="sm" alt="" />
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function AdjacentNav({
  prev,
  next,
  kind,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
  kind: "day" | "month";
}) {
  return (
    <nav aria-label={kind === "day" ? "Adjacent days" : "Adjacent months"} className="mt-8 flex flex-col gap-3 font-ui text-[14px] sm:flex-row sm:items-center sm:justify-between">
      {prev ? (
        <Link href={prev.href} className="text-[#E3120B] hover:underline" rel="prev">
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      <Link href="/archive" className="text-[#5B5B5B] hover:text-[#E3120B]">
        All dates
      </Link>
      {next ? (
        <Link href={next.href} className="text-[#E3120B] hover:underline sm:text-right" rel="next">
          {next.label} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function MonthCalendar({
  year,
  month,
  counts,
}: {
  year: number;
  month: number;
  counts: Map<number, number>;
}) {
  const today = accraToday();
  const cells = monthGrid(year, month);
  return (
    <div className="mt-8">
      <h2 className="font-headline text-xl font-bold text-[#0D0D0D]">Calendar</h2>
      <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-2">
        {ARCHIVE_WEEKDAYS.map((name) => (
          <div key={name} className="py-1 text-center font-ui text-[10px] uppercase tracking-wide text-[#757575] sm:text-[11px]">
            {name}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const count = counts.get(cell.day) ?? 0;
          const isToday = today.year === year && today.month === month && today.day === cell.day;
          const label = `${formatLongDate(year, month, cell.day)}${count ? `, ${articleCountLabel(count)}` : ""}`;
          if (count > 0) {
            return (
              <Link
                key={cell.day}
                href={archiveDayPath(year, month, cell.day)}
                aria-label={label}
                className={`flex min-h-11 flex-col items-center justify-center border border-[#0D0D0D] px-0.5 text-[#0D0D0D] hover:border-[#E3120B] hover:text-[#E3120B] sm:min-h-16 ${isToday ? "ring-2 ring-[#E3120B]" : ""}`}
              >
                <span className="font-ui text-[13px] font-semibold sm:text-[15px]">{cell.day}</span>
                <span className="font-ui text-[10px] text-[#E3120B]">{count}</span>
              </Link>
            );
          }
          return (
            <div
              key={cell.day}
              className={`flex min-h-11 flex-col items-center justify-center font-ui text-[13px] text-[#C4C4C4] sm:min-h-16 sm:text-[15px] ${isToday ? "ring-2 ring-[#E3120B]" : ""}`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MonthDayList({ year, month, counts }: { year: number; month: number; counts: { day: number; count: number }[] }) {
  if (!counts.length) return null;
  return (
    <div className="mt-10">
      <h2 className="font-headline text-xl font-bold text-[#0D0D0D]">Days with stories</h2>
      <ul className="mt-2 border-t border-[#D9D9D9]">
        {counts.map((row) => (
          <li key={row.day} className="border-b border-[#D9D9D9]">
            <Link href={archiveDayPath(year, month, row.day)} className="flex items-baseline justify-between gap-4 py-3 hover:text-[#E3120B]">
              <span className="font-headline text-[18px] font-semibold">{formatLongDate(year, month, row.day)}</span>
              <span className="flex-shrink-0 font-ui text-[13px] text-[#5B5B5B]">{articleCountLabel(row.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
