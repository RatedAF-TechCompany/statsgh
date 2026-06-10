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
    <div className="pt-10 pb-6">
      <div className="mb-5">
        <span className="rubric-bar" />
        <div className="flex items-end justify-between gap-3">
          <h2 className="m-0 p-0">
            <button
              onClick={() => navigate(`/${sectionSlug}`)}
              className="font-ui text-[18px] font-bold text-[#0D0D0D] hover:text-[#E3120B] transition-colors bg-transparent border-0 p-0 leading-none"
            >
              {sectionLabel}
            </button>
          </h2>
          <button
            onClick={() => navigate(`/${sectionSlug}`)}
            className="font-ui text-[13px] font-medium text-[#E3120B] hover:underline whitespace-nowrap"
          >
            More from {sectionLabel} →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 divide-x-0 md:divide-x md:divide-[#D9D9D9]">
        <div className="md:pr-6">
          <StoryItem
            article={lead}
            variant="secondary"
            showImage
            showSummary
          />
        </div>
        <div className="md:col-span-2 md:pl-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:divide-x sm:divide-[#D9D9D9]">
          {supporting.map((article, i) => (
            <div key={article.id} className={i % 2 === 1 ? "sm:pl-6" : ""}>
              <StoryItem article={article} variant="compact" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
