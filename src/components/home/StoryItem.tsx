import { useState } from "react";
import { Link } from "react-router-dom";
import { getSectionLabel } from "@/lib/navigation";

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
  rubricTopic?: string;
  eager?: boolean;
  hideRubric?: boolean;
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

const isNewArticle = (publishedAt?: string | null) => {
  if (!publishedAt) return false;
  return new Date(publishedAt).getTime() > Date.now() - 2 * 60 * 60 * 1000;
};

const deriveLabel = (_sectionLabel?: string, section?: string | null, categorySlug?: string | null) => {
  if (categorySlug) {
    const l = getSectionLabel(categorySlug);
    if (l) return l;
  }
  if (section) {
    const l = getSectionLabel(section);
    if (l) return l;
  }
  return "Top Stories";
};

const Rubric = ({ label, topic }: { label: string; topic?: string }) => (
  <div className="mb-2">
    <span className="rubric-bar" />
    <span className="rubric">
      {label}
      {topic && <span> | {topic}</span>}
    </span>
  </div>
);

const NewTag = () => (
  <span className="inline-block bg-[#0D7680] text-white text-[9px] font-bold uppercase px-1.5 py-0.5 mr-2 tracking-wide align-middle">
    NEW
  </span>
);

const Byline = ({ author, publishedAt }: { author?: string | null; publishedAt: string | null }) => {
  const time = getTimeAgo(publishedAt);
  if (!author && !time) return null;

  return (
    <div
      className="mt-2 flex items-center font-ui text-[12px] whitespace-nowrap overflow-hidden"
      style={{ flexWrap: "nowrap" }}
    >
      {author && <span className="font-medium text-[#666] truncate min-w-0 flex-shrink">{author}</span>}
      {author && time && <span className="flex-shrink-0 px-1.5 text-[#999]">|</span>}
      {time && <span suppressHydrationWarning className="flex-shrink-0 text-[#999]">{time}</span>}
    </div>
  );
};

export const StoryItem = ({
  article,
  variant,
  showImage = false,
  showSummary = false,
  sectionLabel,
  rubricTopic,
  eager = false,
  hideRubric = false,
}: StoryItemProps) => {
  const [imgError, setImgError] = useState(false);
  const href = `/${article.category_slug}/${article.slug}`;
  const label = deriveLabel(sectionLabel, article.section, article.category_slug);
  const showNew = isNewArticle(article.published_at);

  const validUrl =
    typeof article.hero_image_url === "string" &&
    article.hero_image_url.trim().startsWith("http");
  const hasImage = showImage && validUrl && !imgError;

  const headlineSize =
    variant === "lead" ? "text-[30px]" : variant === "secondary" ? "text-[19px]" : "text-[16px]";
  const clampClass =
    variant === "lead" ? "line-clamp-4" : variant === "secondary" ? "line-clamp-3" : "line-clamp-2";
  const dekClamp = variant === "lead" ? "line-clamp-3" : "line-clamp-2";

  // LEAD — image left, text right; collapse image column when no image
  if (variant === "lead") {
    if (hasImage) {
      return (
        <Link to={href} className="group relative block h-full min-h-[340px] overflow-hidden bg-[#121212] md:min-h-[430px]">
          <img
            src={article.hero_image_url as string}
            alt=""
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-6">
            {article.is_breaking && <span className="mb-2 block font-ui text-[11px] font-bold uppercase text-[#FFB3AF]">Breaking</span>}
            <span className="mb-2 block font-ui text-[10px] font-bold uppercase text-white/80">{label}</span>
            <h3 className="font-headline text-[28px] font-bold leading-[1.12] text-white md:text-[38px] line-clamp-4">
              {showNew && <NewTag />}{article.title}
            </h3>
            {showSummary && article.summary && <p className="mt-2 hidden max-w-2xl font-serif text-[15px] leading-[1.4] text-white/85 sm:line-clamp-2">{article.summary}</p>}
            <div className="mt-2 font-ui text-[11px] text-white/75">
              <span suppressHydrationWarning>{[article.author_name, getTimeAgo(article.published_at ?? null)].filter(Boolean).join(" · ")}</span>
            </div>
          </div>
        </Link>
      );
    }
    return (
      <Link
        to={href}
        className="block group"
      >
        <div className="grid grid-cols-1 gap-y-4">
          <div className="min-w-0">
            {!hideRubric && <Rubric label={label} topic={rubricTopic} />}
            {article.is_breaking && (
              <span className="block font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-[#E3120B] mb-2">
                Breaking
              </span>
            )}
            <h3 className="font-headline text-[32px] font-bold leading-[1.15] tracking-[-0.015em] text-[#0D0D0D] headline-link line-clamp-4">
              {showNew && <NewTag />}
              {article.title}
            </h3>
            {showSummary && article.summary && (
              <p className="font-serif text-[16px] text-[#5B5B5B] mt-2.5 leading-[1.45] line-clamp-3">
                {article.summary}
              </p>
            )}
            <Byline author={article.author_name} publishedAt={article.published_at ?? null} />
          </div>
        </div>
      </Link>
    );
  }

  // SECONDARY / COMPACT
  return (
    <Link
      to={href}
      className="block group py-3 border-t border-[#e8e8e8] first:border-t-0"
    >
      <div className="flex items-start gap-3">
        {hasImage && (
          <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-[#F5F5F5]">
            <img
              src={article.hero_image_url as string}
              alt=""
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
              onError={() => setImgError(true)}
              className="hover-fade w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {!hideRubric && <Rubric label={label} />}
          {article.is_breaking && (
            <span className="block font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-[#E3120B] mb-1">
              Breaking
            </span>
          )}
          <h3 className={`font-headline ${headlineSize} font-bold leading-[1.15] tracking-[-0.015em] text-[#0D0D0D] headline-link ${clampClass}`}>
            {showNew && <NewTag />}
            {article.title}
          </h3>
          {showSummary && article.summary && (
            <p className={`font-serif text-[15px] text-[#5B5B5B] mt-2 leading-[1.45] ${dekClamp}`}>
              {article.summary}
            </p>
          )}
          <Byline author={article.author_name} publishedAt={article.published_at ?? null} />
        </div>
      </div>
    </Link>
  );
};
