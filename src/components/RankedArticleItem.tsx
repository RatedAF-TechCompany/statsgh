import { useNavigate } from "react-router-dom";
import { CATEGORY_MAPPING } from "@/lib/navigation";

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
  };
  rank: number;
  isHero?: boolean;
  showImage?: boolean;
}

export const RankedArticleItem = ({ article, rank, isHero, showImage = false }: RankedArticleItemProps) => {
  const navigate = useNavigate();

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

  if (isHero) {
    return (
      <div 
        className="pb-4 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
      >
        {article.hero_image_url && (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-full aspect-video object-cover mb-3"
          />
        )}
        <h2 className="font-serif text-xl font-medium leading-[1.3] text-foreground mb-1.5">
          {article.title}
        </h2>
        {article.summary && (
          <p className="font-serif text-sm leading-5 text-muted-foreground mb-4">
            {article.summary}
          </p>
        )}
        <div className="border-t border-border" />
      </div>
    );
  }

  return (
    <div 
      className="py-3 cursor-pointer hover:opacity-90 transition-opacity border-b border-border"
      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
    >
      <div className={showImage && article.hero_image_url ? "flex gap-3" : ""}>
        <div className="flex-1">
          <h3 className="font-serif text-[17px] leading-[23px] font-medium text-ft-maroon mb-1">
            {article.title}
          </h3>
          {article.published_at && (
            <p className="font-sans text-[13px] text-ft-maroon">
              <span className="font-semibold">{categoryLabel}</span>
              <span className="mx-1.5">•</span>
              <span>{getTimeAgo(article.published_at)}</span>
            </p>
          )}
        </div>
        {showImage && article.hero_image_url && (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-24 h-16 object-cover flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
};
