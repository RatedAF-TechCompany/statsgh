import { useNavigate } from "react-router-dom";
import { FTSectionLabel } from "./FTSectionLabel";
import { StoryItem } from "./StoryItem";

interface Article {
  id: string;
  title: string;
  slug: string;
  category_slug: string;
  summary: string;
  hero_image_url: string | null;
  published_at: string | null;
  word_count: number | null;
  author_name?: string | null;
  is_breaking?: boolean;
  section?: string | null;
}

interface SectionBlockProps {
  sectionLabel: string;
  sectionSlug: string;
  articles: Article[];
}

export const SectionBlock = ({ sectionLabel, sectionSlug, articles }: SectionBlockProps) => {
  const navigate = useNavigate();
  // Minimum 4 articles to render a section
  if (articles.length < 4) return null;

  const lead = articles[0];
  const supporting = articles.slice(1, 7); // up to 6 supporting

  return (
    <div className="pt-12 pb-6">
      {/* Section header: Playfair name on hairline + kicker-style More link */}
      <div className="border-t border-[#121212] pt-3 mb-6 flex items-end justify-between gap-3">
        <h2 className="m-0 p-0">
          <button
            onClick={() => navigate(`/${sectionSlug}`)}
            className="font-headline text-[24px] font-bold text-[#121212] hover:text-[#8B0000] transition-colors bg-transparent border-0 p-0 leading-none"
          >
            {sectionLabel}
          </button>
        </h2>
        <button
          onClick={() => navigate(`/${sectionSlug}`)}
          className="kicker whitespace-nowrap"
        >
          More →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-0">
        {/* Lead story — spans first column */}
        <div className="md:col-span-1">
          <StoryItem
            article={lead}
            variant="secondary"
            showImage={!!lead.hero_image_url}
            showSummary
          />
        </div>

        {/* Supporting stories — 2 columns */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-0">
          {supporting.map((article) => (
            <StoryItem
              key={article.id}
              article={article}
              variant="compact"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
