import { bylineFor, RESEARCH_BYLINE, DEFAULT_BYLINE } from "@/lib/authorSlugs";

/**
 * Short production note on every article (Google guidance on AI-assisted content; research plan
 * 15 Nov 2026). Wording only restates practices already published on /editorial-standards and
 * the StatsGH Newsroom profile. Sign-off editor: Hawa Kokonu, Chief Editor (Zeb, 15 Nov 2026).
 */
export function HowThisWasMade({ authorName, isResearch }: { authorName?: string | null; isResearch: boolean }) {
  const b = bylineFor(authorName);
  const who =
    b.slug === RESEARCH_BYLINE.slug
      ? "Written for StatsGH's research section and edited by Zebrilla Najib, Research Editor."
      : b.slug === DEFAULT_BYLINE.slug
      ? "Compiled from official releases and news reports, with every source linked in the text."
      : `Reported by ${b.name} from the primary sources linked in the text.${isResearch ? " Edited by Zebrilla Najib, Research Editor." : ""}`;
  return (
    <aside className="mb-8 border border-[#D9D9D9] bg-[#FAFAFA] p-4" aria-label="How this story was made">
      <h2 className="font-ui text-xs font-bold uppercase tracking-[0.12em] text-[#5B5B5B] mb-2">How this story was made</h2>
      <p className="font-ui text-[13px] leading-[1.6] text-[#121212]">
        {who} Signed off for publication by{" "}
        <a href="/authors/hawa-kokonu" className="underline">Hawa Kokonu</a>, Chief Editor. StatsGH uses AI-assisted drafting to turn reporting into plain English; AI is never used to invent facts, quotes or
        statistics. Figures are checked against their cited sources before publication.{" "}
        <a href="/editorial-standards" className="underline text-[#E3120B]">Our standards</a> ·{" "}
        <a href="/corrections" className="underline text-[#E3120B]">Report an error</a>
      </p>
    </aside>
  );
}
