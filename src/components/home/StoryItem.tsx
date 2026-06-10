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
      className={`cursor-pointer group ${variant !== "lead" ? "border-t border-[#E5E2DC] pt-3" : ""}`}
      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
    >
      {/* Inline tags */}
      <div className="flex items-center gap-2 mb-1">
        {article.is_breaking && (
          <span className="font-ui text-[10px] font-bold uppercase text-[#8B0000]">
            Breaking
          </span>
        )}
        {article.section === "analysis" && (
          <span className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#8B0000] border border-[#8B0000] px-1.5 py-px">
            Analysis
          </span>
        )}
        {article.section === "financial-literacy" && (
          <span className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#B8860B] border border-[#B8860B] px-1.5 py-px">
            Explainer
          </span>
        )}
        {isNew(article.published_at ?? null) && (
          <span className="font-ui text-[10px] font-bold uppercase text-[#8B0000]">
            New
          </span>
        )}
        {sectionLabel && (
          <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8B0000]">
            {sectionLabel}
          </span>
        )}
      </div>

      <div className={showImage && article.hero_image_url ? "flex gap-3" : ""}>
        <div className="flex-1 min-w-0">
          <h3
            className={`font-headline ${headlineSize} ${fontWeight} leading-[1.2] text-[#121212] group-hover:text-[#8B0000] transition-colors tracking-[-0.01em]`}
          >
            {article.title}
          </h3>

          {showSummary && article.summary && (
            <p className="font-serif text-[14px] text-[#555555] mt-1 leading-[1.4] line-clamp-2">
              {article.summary}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-1.5">
            {article.author_name && (
              <span className="font-ui text-[11px] text-[#555555]">
                {article.author_name}
              </span>
            )}
            {article.author_name && article.published_at && (
              <span className="font-ui text-[11px] text-[#555555]">·</span>
            )}
            {article.published_at && (
              <span className="font-ui text-[11px] text-[#555555]">
                {getTimeAgo(article.published_at)}
              </span>
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
