import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { getSectionLabel } from "@/lib/navigation";

interface Article {
  id: string;
  title: string;
  slug: string;
  category_slug: string;
  summary: string;
  hero_image_url: string | null;
  published_at: string | null;
  word_count: number | null;
}

const getTimeAgo = (publishedAt: string | null) => {
  if (!publishedAt) return "";
  const now = new Date();
  const published = new Date(publishedAt);
  const minutesAgo = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo}d ago`;
};

interface SectionBlockProps {
  sectionLabel: string;
  sectionSlug: string;
  articles: Article[];
}

export const SectionBlock = ({ sectionLabel, sectionSlug, articles }: SectionBlockProps) => {
  const navigate = useNavigate();
  if (articles.length === 0) return null;

  const lead = articles[0];
  const smallStories = articles.slice(1, 4);

  return (
    <div className="pt-8 pb-8 border-t border-[#E8D9C5]">
      {/* Section label */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(`/${sectionSlug}`)}
          className="section-label border-b border-[#0D7680] pb-1"
        >
          {sectionLabel}
        </button>
        <button
          onClick={() => navigate(`/${sectionSlug}`)}
          className="font-ui text-xs text-[#0D7680] hover:underline"
        >
          More {sectionLabel} →
        </button>
      </div>

      {/* Lead story */}
      <article
        className="cursor-pointer group mb-5"
        onClick={() => navigate(`/${lead.category_slug}/${lead.slug}`)}
      >
        <h3 className="font-headline text-2xl font-bold leading-snug text-[#33302E] group-hover:text-[#0D7680] transition-colors">
          {lead.title}
        </h3>
        {lead.summary && (
          <p className="font-serif text-[15px] text-[#66605A] mt-2 line-clamp-2 leading-relaxed">
            {lead.summary}
          </p>
        )}
        {lead.published_at && (
          <span className="font-ui text-xs text-[#66605A] mt-2 block">
            {getTimeAgo(lead.published_at)}
          </span>
        )}
      </article>

      {/* 3 smaller stories */}
      {smallStories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {smallStories.map((article) => (
            <article
              key={article.id}
              className="cursor-pointer group"
              onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
            >
              <span className="section-label text-[10px]">
                {getSectionLabel(article.category_slug)}
              </span>
              <h4 className="font-headline text-base font-semibold leading-snug text-[#33302E] group-hover:text-[#0D7680] transition-colors mt-1">
                {article.title}
              </h4>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
