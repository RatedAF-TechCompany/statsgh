import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { CATEGORY_MAPPING } from "@/lib/navigation";
import { formatTime } from "@/components/ReadingTime";

interface RankedArticleItemProps {
  article: {
    id: string;
    title: string;
    summary: string;
    section: string;
    slug: string;
    category_slug: string;
    hero_image_url?: string | null;
    published_at?: string | null;
    word_count?: number | null;
    is_wire?: boolean;
  };
  rank: number;
  isHero?: boolean;
  showImage?: boolean;
}

export const RankedArticleItem = ({ article, rank, isHero, showImage = false }: RankedArticleItemProps) => {
  const href = `/${article.category_slug}/${article.slug}`;

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

  const categoryLabel = CATEGORY_MAPPING[article.category_slug as keyof typeof CATEGORY_MAPPING] || article.category_slug;
  const readingTime = article.word_count ? formatTime(article.word_count / 238) : null;

  if (isHero) {
    return (
      <Link
        to={href}
        className="block pb-4 hover:opacity-90 transition-opacity"
      >
        {article.hero_image_url && (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-full aspect-video object-cover mb-3"
          />
        )}
        <h2 className="font-serif text-xl font-medium leading-[1.3] text-[#7A0034] mb-1.5">
          {article.title}
        </h2>
        {article.summary && (
          <p className="font-serif text-sm leading-5 text-muted-foreground mb-2">
            {article.summary}
          </p>
        )}
        <p className="font-sans text-[13px] text-black mb-4 flex items-center flex-wrap gap-x-1.5">
          <span className="font-semibold">{categoryLabel}</span>
          {article.published_at && (
            <>
              <span>•</span>
              <span>{getTimeAgo(article.published_at)}</span>
            </>
          )}
          {readingTime && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {readingTime} read
              </span>
            </>
          )}
        </p>
        <div className="border-t border-border" />
      </Link>
    );
  }

  return (
    <Link
      to={href}
      className="block py-3 hover:opacity-90 transition-opacity border-b border-border"
    >
      <div className={showImage && article.hero_image_url ? "flex gap-3" : ""}>
        <div className="flex-1">
          <h3 className="font-serif text-[17px] leading-[23px] font-medium text-ft-maroon mb-1">
            {article.title}
          </h3>
          <p className="font-sans text-[13px] text-black flex items-center flex-wrap gap-x-1.5">
            <span className="font-semibold">{categoryLabel}</span>
            {article.published_at && (
              <>
                <span>•</span>
                <span>{getTimeAgo(article.published_at)}</span>
              </>
            )}
            {readingTime && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {readingTime} read
                </span>
              </>
            )}
          </p>
        </div>
        {showImage && article.hero_image_url && (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-24 h-16 object-cover flex-shrink-0"
          />
        )}
      </div>
    </Link>
  );
};
