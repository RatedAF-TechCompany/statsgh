import { Link } from "react-router-dom";
import { CATEGORY_MAPPING } from "@/lib/navigation";

interface SecondaryStoryProps {
  article: {
    id: string;
    title: string;
    summary?: string;
    slug: string;
    category_slug: string;
    hero_image_url?: string | null;
    published_at?: string | null;
  };
  showImage?: boolean;
  variant?: "default" | "compact" | "horizontal";
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

export const SecondaryStory = ({ article, showImage = true, variant = "default" }: SecondaryStoryProps) => {
  const categoryLabel = CATEGORY_MAPPING[article.category_slug as keyof typeof CATEGORY_MAPPING] || article.category_slug;
  const href = `/${article.category_slug}/${article.slug}`;

  if (variant === "horizontal") {
    return (
      <Link
        to={href}
        className="block py-3 border-b border-border group"
      >
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[11px] uppercase tracking-wider text-ft-maroon font-semibold mb-1">
              {categoryLabel}
            </p>
            <h3 className="font-serif text-base font-semibold leading-snug text-foreground group-hover:text-ft-maroon transition-colors line-clamp-3">
              {article.title}
            </h3>
            {article.published_at && (
              <p className="font-sans text-xs text-muted-foreground mt-1">
                {getTimeAgo(article.published_at)}
              </p>
            )}
          </div>
          {showImage && article.hero_image_url && (
            <img 
              src={article.hero_image_url} 
              alt=""
              width={80}
              height={80}
              loading="lazy"
              decoding="async"
              className="w-20 h-20 object-cover flex-shrink-0"
            />
          )}
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        to={href}
        className="block py-2.5 border-b border-border group"
      >
        <p className="font-sans text-[10px] uppercase tracking-wider text-ft-maroon font-semibold mb-0.5">
          {categoryLabel}
        </p>
        <h3 className="font-serif text-sm font-medium leading-snug text-foreground group-hover:text-ft-maroon transition-colors">
          {article.title}
        </h3>
      </Link>
    );
  }

  return (
    <Link
      to={href}
      className="block group"
    >
      {showImage && article.hero_image_url && (
        <div className="mb-2 overflow-hidden">
          <img 
            src={article.hero_image_url} 
            alt=""
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}
      <p className="font-sans text-[11px] uppercase tracking-wider text-ft-maroon font-semibold mb-1">
        {categoryLabel}
      </p>
      <h3 className="font-serif text-lg font-semibold leading-snug text-foreground group-hover:text-ft-maroon transition-colors">
        {article.title}
      </h3>
      {article.summary && (
        <p className="font-serif text-sm leading-relaxed text-muted-foreground mt-1 line-clamp-2">
          {article.summary}
        </p>
      )}
      {article.published_at && (
        <p className="font-sans text-xs text-muted-foreground mt-2">
          {getTimeAgo(article.published_at)}
        </p>
      )}
    </Link>
  );
};
