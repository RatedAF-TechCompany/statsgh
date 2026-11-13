import { sanitizeArticleHtml } from "@/lib/safe-html";
import { formatGmt, formatGmtShort } from "@/lib/live/format";
import type { LiveEntry } from "@/lib/live/types";

export function LiveFeed({ entries }: { entries: LiveEntry[] }) {
  return (
    <ol className="border-t border-[#D9D9D9]" aria-label="Live reporting">
      {entries.map((entry) => (
        <li
          key={entry.id}
          id={`entry-${entry.id}`}
          className="py-6 border-b border-[#E8E8E8] scroll-mt-24"
        >
          <p className="font-ui text-[12px] text-[#5B5B5B] mb-1.5" title={formatGmt(entry.posted_at)}>
            {formatGmtShort(entry.posted_at)}
            {entry.is_wrapup ? <span className="ml-2 uppercase tracking-wide text-[#121212]">Wrap-up</span> : null}
          </p>
          <h2 className="font-headline text-[20px] md:text-[22px] font-bold leading-snug text-[#121212] mb-3">
            {entry.title}
          </h2>
          <div
            className="font-serif text-[17px] leading-[1.6] text-[#121212] space-y-3 [&_a]:text-[#0F5499] [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(entry.body) }}
          />
          {entry.image_url ? (
            <figure className="mt-4">
              <img
                src={entry.image_url}
                alt={entry.image_alt || ""}
                className="w-full max-w-2xl"
              />
              {entry.image_caption ? (
                <figcaption
                  className="font-ui text-[12px] text-[#5B5B5B] mt-1.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(entry.image_caption) }}
                />
              ) : null}
            </figure>
          ) : null}
          {entry.source_url ? (
            <p className="mt-3 font-ui text-[13px]">
              <a href={entry.source_url} className="text-[#0F5499] underline" rel="noopener noreferrer" target="_blank">
                {entry.source_label || "Source"}
              </a>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
