import { useNavigate } from "react-router-dom";
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
    is_breaking?: boolean;
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

const isNew = (publishedAt: string | null) => {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < 2 * 60 * 60 * 1000;
};

export const LeadStory = ({ article }: LeadStoryProps) => {
  const navigate = useNavigate();
  const categoryLabel = CATEGORY_MAPPING[article.category_slug as keyof typeof CATEGORY_MAPPING] || article.category_slug;
  const readingTime = article.word_count ? formatTime(article.word_count / 238) : null;

  return (
    <article 
      className="cursor-pointer group"
      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
    >
      {article.hero_image_url && (
        <div className="mb-4 overflow-hidden">
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            width={800}
            height={450}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}
      <div className="space-y-2">
        {article.is_breaking && (
          <span className="inline-block bg-[#E3120B] text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5">
            Breaking
          </span>
        )}
        <p className="kicker">
          {categoryLabel}
        </p>
        <h1 className="font-headline text-[34px] md:text-[40px] font-bold leading-[1.15] tracking-[-0.01em] headline-link">
          {article.title}
        </h1>
        {article.summary && (
          <p className="font-serif text-[16px] leading-[1.5] text-[#5B5B5B] max-w-[640px]">
            {article.summary}
          </p>
        )}
        <p className="font-ui text-[13px] text-[#757575] flex items-center gap-2 pt-1">
          {isNew(article.published_at ?? null) && (
            <>
              <span className="inline-flex items-center gap-1 text-[#5B5B5B] font-semibold uppercase tracking-[0.12em] text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B5B5B] inline-block" />
                New
              </span>
              <span>·</span>
            </>
          )}
          {article.published_at && (
            <span>{getTimeAgo(article.published_at)}</span>
          )}
          {readingTime && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {readingTime} read
              </span>
            </>
          )}
        </p>
      </div>
    </article>
  );
};
