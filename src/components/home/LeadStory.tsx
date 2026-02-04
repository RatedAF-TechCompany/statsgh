import Link from "next/link";
import { Clock } from "lucide-react";
import { CATEGORY_MAPPING } from "@/lib/navigation";
import { formatTime } from "@/components/ReadingTime";

interface LeadStoryProps {
  article: {
    id: string;
    title: string;
    summary: string;
    slug: string;
    category_slug: string;
    hero_image_url?: string | null;
    published_at?: string | null;
    word_count?: number | null;
  };
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

export const LeadStory = ({ article }: LeadStoryProps) => {
  const categoryLabel = CATEGORY_MAPPING[article.category_slug as keyof typeof CATEGORY_MAPPING] || article.category_slug;
  const readingTime = article.word_count ? formatTime(article.word_count / 238) : null;

  return (
    <Link href={`/${article.category_slug}/${article.slug}`} className="block group">
      <article className="cursor-pointer">
        {article.hero_image_url && (
          <div className="mb-4 overflow-hidden">
            <img
              src={article.hero_image_url}
              alt={article.title}
              className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        )}
        <div className="space-y-2">
          <p className="font-sans text-xs uppercase tracking-wider text-ft-maroon font-semibold">
            {categoryLabel}
          </p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold leading-tight text-foreground group-hover:text-ft-maroon transition-colors">
            {article.title}
          </h1>
          {article.summary && (
            <p className="font-serif text-base md:text-lg leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}
          <p className="font-sans text-xs text-muted-foreground flex items-center gap-2 pt-1">
            {article.published_at && <span>{getTimeAgo(article.published_at)}</span>}
            {readingTime && (
              <>
                <span>-</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {readingTime} read
                </span>
              </>
            )}
          </p>
        </div>
      </article>
    </Link>
  );
};
