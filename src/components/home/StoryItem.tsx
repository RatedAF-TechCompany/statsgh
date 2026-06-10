import { useNavigate } from "react-router-dom";

interface StoryItemProps {
  article: {
    id: string;
    title: string;
    slug: string;
    category_slug: string;
    summary?: string | null;
    hero_image_url?: string | null;
    published_at?: string | null;
    author_name?: string | null;
    is_breaking?: boolean;
    section?: string | null;
  };
  variant: "lead" | "secondary" | "compact";
  showImage?: boolean;
  showSummary?: boolean;
  sectionLabel?: string;
}

const getTimeAgo = (publishedAt: string | null) => {
  if (!publishedAt) return "";
  const now = Date.now();
  const pub = new Date(publishedAt).getTime();
  const mins = Math.floor((now - pub) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const isNew = (publishedAt: string | null) => {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < 2 * 60 * 60 * 1000;
};

export const StoryItem = ({
  article,
  variant,
  showImage = false,
  showSummary = false,
  sectionLabel,
}: StoryItemProps) => {
  const navigate = useNavigate();

  const headlineSize =
    variant === "lead"
      ? "text-[28px] md:text-[28px]"
      : variant === "secondary"
      ? "text-[18px]"
      : "text-[15px]";

  const fontWeight = variant === "compact" ? "font-medium" : "font-bold";

  return (
    <article
      className={`cursor-pointer group ${variant !== "lead" ? "border-t border-[#E5E2DC] pt-3" : ""} mb-4`}
      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
    >
      {/* Kicker line */}
      <div className="flex items-center gap-2 mb-2">
        {article.is_breaking && (
          <span className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-[#8B0000]">
            Breaking
          </span>
        )}
        {(sectionLabel || article.section === "analysis" || article.section === "financial-literacy") && (
          <span className="kicker">
            {sectionLabel || (article.section === "analysis" ? "Analysis" : "Explainer")}
          </span>
        )}
      </div>

      <div className={showImage && article.hero_image_url ? "flex gap-3" : ""}>
        <div className="flex-1 min-w-0">
          <h3
            className={`font-headline ${headlineSize} ${fontWeight} leading-[1.25] tracking-[-0.01em] headline-link`}
          >
            {article.title}
          </h3>

          {showSummary && article.summary && (
            <p className="font-serif text-[15px] text-[#555555] mt-2 leading-[1.5] line-clamp-2">
              {article.summary}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-3 font-ui text-[13px]">
            {article.author_name && (
              <>
                <span className="text-[#8A8A8A]">By </span>
                <span className="font-semibold text-[#121212]">{article.author_name}</span>
              </>
            )}
            {article.author_name && article.published_at && (
              <span className="text-[#8A8A8A]">·</span>
            )}
            {isNew(article.published_at ?? null) && (
              <>
                <span className="inline-flex items-center gap-1 text-[#B8860B] font-semibold uppercase tracking-[0.12em] text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8860B] inline-block" />
                  New
                </span>
                <span className="text-[#8A8A8A]">·</span>
              </>
            )}
            {article.published_at && (
              <span className="text-[#8A8A8A]">{getTimeAgo(article.published_at)}</span>
            )}
          </div>
        </div>

        {showImage && article.hero_image_url && (
          <img
            src={article.hero_image_url}
            alt=""
            loading="lazy"
            decoding="async"
            width={variant === "lead" ? 480 : 80}
            height={variant === "lead" ? 270 : 80}
            className={`object-cover flex-shrink-0 ${
              variant === "lead" ? "w-full mt-3 aspect-[16/9]" : "w-20 h-20"
            }`}
          />
        )}
      </div>
    </article>
  );
};
