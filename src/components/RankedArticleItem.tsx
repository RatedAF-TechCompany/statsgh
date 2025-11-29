import { useNavigate } from "react-router-dom";

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
}

export const RankedArticleItem = ({ article, rank, isHero }: RankedArticleItemProps) => {
  const navigate = useNavigate();

  const getTimeAgo = (publishedAt: string | null) => {
    if (!publishedAt) return "";
    const now = new Date();
    const published = new Date(publishedAt);
    const hoursAgo = Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60));
    if (hoursAgo < 24) return `${hoursAgo} HOURS AGO`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} DAYS AGO`;
  };

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
      className="py-4 cursor-pointer hover:opacity-90 transition-opacity border-b border-border"
      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
    >
      <h3 className="font-serif text-lg font-medium leading-6 text-foreground mb-1">
        {article.title}
      </h3>
      {article.summary && (
        <p className="font-serif text-sm leading-5 text-muted-foreground mb-1">
          {article.summary}
        </p>
      )}
      {article.published_at && (
        <p className="font-serif text-xs font-medium tracking-[0.125em] uppercase text-muted-foreground">
          {getTimeAgo(article.published_at)}
        </p>
      )}
    </div>
  );
};
