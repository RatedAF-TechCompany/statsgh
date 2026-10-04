import { Link } from "react-router-dom";
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
  if (articles.length === 0) return null;
  const visible = articles.slice(0, 8);

  return (
    <section className="border-b border-[#D9D9D9] py-5 md:py-6">
      <div className="mb-3 border-t-4 border-[#E3120B] pt-2">
        <div className="flex items-end justify-between gap-3">
          <h2 className="m-0 p-0">
            <Link
              to={`/${sectionSlug}`}
              className="font-ui text-[18px] font-bold text-[#0D0D0D] hover:text-[#E3120B] transition-colors bg-transparent border-0 p-0 leading-none"
            >
              {sectionLabel}
            </Link>
          </h2>
          <Link
            to={`/${sectionSlug}`}
            className="font-ui text-[13px] font-medium text-[#E3120B] hover:underline whitespace-nowrap"
          >
            More from {sectionLabel} →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-x-5">
        {visible.map((article, index) => (
          <div key={article.id} className="min-w-0 border-b border-[#E8E8E8] last:border-b-0 sm:border-b-0">
            <StoryItem
              article={article}
              variant={index === 0 ? "secondary" : "compact"}
              showImage={index < 4}
              showSummary={index === 0}
              hideRubric={index !== 0}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
