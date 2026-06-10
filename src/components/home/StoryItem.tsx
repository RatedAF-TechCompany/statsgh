import { useNavigate } from "react-router-dom";
import { getSectionFallback } from "@/lib/sectionFallback";

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
  eager?: boolean;
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
  eager = false,
}: StoryItemProps) => {
  const navigate = useNavigate();

  const headlineSize =
    variant === "lead"
      ? "text-[28px] md:text-[28px]"
      : variant === "secondary"
      ? "text-[18px]"
      : "text-[15px]";

  const clampClass =
    variant === "lead"
      ? "line-clamp-4"
      : variant === "secondary"
      ? "line-clamp-3"
      : "line-clamp-2";

  const dekClamp = variant === "lead" ? "line-clamp-3" : "line-clamp-2";
  const fontWeight = variant === "compact" ? "font-medium" : "font-bold";

  const imgSrc = article.hero_image_url || getSectionFallback(article.section, article.category_slug);

  // LEAD: image full-width on top
  if (variant === "lead") {
    return (
      <article
        className="cursor-pointer group"
        onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
      >
        {showImage && (
          <div className="mb-3 overflow-hidden bg-[#F5F2EC] aspect-[3/2]">
            <img
              src={imgSrc}
              alt=""
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : "auto"}
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          {article.is_breaking && (
            <span className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-[#E3120B]">
              Breaking
            </span>
          )}
          {(sectionLabel || article.section === "analysis" || article.section === "financial-literacy") && (
            <span className="kicker">
              {sectionLabel || (article.section === "analysis" ? "Analysis" : "Explainer")}
            </span>
          )}
        </div>

        <h3 className={`font-headline text-[28px] font-bold leading-[1.15] tracking-[-0.01em] headline-link line-clamp-4`}>
          {article.title}
        </h3>

        {showSummary && article.summary && (
          <p className="font-serif text-[16px] text-[#5B5B5B] mt-2 leading-[1.5] line-clamp-3">
            {article.summary}
          </p>
        )}

        <Byline author={article.author_name} publishedAt={article.published_at ?? null} />
      </article>
    );
  }

  // SECONDARY / COMPACT: 80px thumb left, content right
  return (
    <article
      className="cursor-pointer group py-4 border-b border-[#D9D9D9] last:border-b-0"
      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
    >
      <div className="flex items-start gap-3">
        {showImage && (
          <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-[#F5F2EC]">
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {article.is_breaking && (
              <span className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-[#E3120B]">
                Breaking
              </span>
            )}
            {(sectionLabel || article.section === "analysis" || article.section === "financial-literacy") && (
              <span className="kicker">
                {sectionLabel || (article.section === "analysis" ? "Analysis" : "Explainer")}
              </span>
            )}
          </div>

          <h3 className={`font-headline ${headlineSize} ${fontWeight} leading-[1.25] tracking-[-0.01em] headline-link ${clampClass}`}>
            {article.title}
          </h3>

          {showSummary && article.summary && (
            <p className={`font-serif text-[14px] text-[#5B5B5B] mt-1.5 leading-[1.45] ${dekClamp}`}>
              {article.summary}
            </p>
          )}

          <Byline author={article.author_name} publishedAt={article.published_at ?? null} />
        </div>
      </div>
    </article>
  );
};

// ── Single-line byline; truncates author on overflow ──
const Byline = ({ author, publishedAt }: { author?: string | null; publishedAt: string | null }) => {
  const time = getTimeAgo(publishedAt);
  const showNew = isNew(publishedAt);
  if (!author && !time && !showNew) return null;

  return (
    <div
      className="mt-2.5 flex items-center font-ui text-[13px] text-[#757575] whitespace-nowrap overflow-hidden"
      style={{ flexWrap: "nowrap" }}
    >
      {author && (
        <span className="flex items-center min-w-0 flex-shrink">
          <span className="flex-shrink-0">By&nbsp;</span>
          <span className="font-semibold text-[#121212] truncate">{author}</span>
        </span>
      )}
      {author && time && <span className="flex-shrink-0 px-1.5">·</span>}
      {time && <span className="flex-shrink-0">{time}</span>}
      {showNew && (
        <span className="flex-shrink-0 inline-flex items-center gap-1 ml-2 text-[#5B5B5B]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5B5B5B] inline-block" />
          <span className="font-semibold">New</span>
        </span>
      )}
    </div>
  );
};
