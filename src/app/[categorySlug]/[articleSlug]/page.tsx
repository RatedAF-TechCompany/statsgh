import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { CATEGORY_MAPPING } from "@/lib/navigation";
import ArticleContent from "./ArticleContent";

interface ArticlePageProps {
  params: Promise<{
    categorySlug: string;
    articleSlug: string;
  }>;
}

// Fetch article data for both metadata and page rendering
async function getArticle(categorySlug: string, articleSlug: string) {
  const supabase = createReadOnlyServerClient();

  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", articleSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !article) {
    return null;
  }

  return article;
}

// Generate metadata for SEO (server-side rendered)
export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { categorySlug, articleSlug } = await params;
  const article = await getArticle(categorySlug, articleSlug);

  if (!article) {
    return {
      title: "Article Not Found - StatsGH",
    };
  }

  const canonicalUrl = `https://statsgh.com/${article.category_slug}/${article.slug}`;
  const baseUrl = "https://statsgh.com";

  const makeAbsoluteUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${baseUrl}${url}`;
    return `${baseUrl}/${url}`;
  };

  const absoluteImageUrl = makeAbsoluteUrl(article.hero_image_url);
  const description = article.seo_description || article.summary || "";

  // Format keywords for Google News
  const keywords = article.tags?.join(", ") || "";

  return {
    title: `${article.title} - StatsGH`,
    description,
    keywords: keywords || undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: canonicalUrl,
      siteName: "StatsGH",
      locale: "en_GH",
      ...(absoluteImageUrl && {
        images: [
          {
            url: absoluteImageUrl,
            width: 1200,
            height: 630,
            alt: article.title,
          },
        ],
      }),
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at || undefined,
      authors: article.author_name ? [article.author_name] : undefined,
      section: article.section || undefined,
    },
    twitter: {
      card: absoluteImageUrl ? "summary_large_image" : "summary",
      site: "@StatsGH",
      creator: "@StatsGH",
      title: article.title,
      description,
      ...(absoluteImageUrl && { images: [absoluteImageUrl] }),
    },
    other: {
      "article:published_time": article.published_at || "",
      "article:modified_time": article.updated_at || "",
      "article:author": article.author_name || "",
      "article:section": article.section || "",
      // Google News specific
      "news_keywords": keywords,
      "original-source": canonicalUrl,
    },
  };
}

// Generate JSON-LD structured data for Google News
function generateJsonLd(article: any) {
  const baseUrl = "https://statsgh.com";

  const makeAbsoluteUrl = (url: string | null) => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${baseUrl}${url}`;
    return `${baseUrl}/${url}`;
  };

  const articleUrl = `${baseUrl}/${article.category_slug}/${article.slug}`;
  const imageUrl = makeAbsoluteUrl(article.hero_image_url);

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.seo_description || article.summary,
    image: imageUrl
      ? {
          "@type": "ImageObject",
          url: imageUrl,
          width: 1200,
          height: 630,
        }
      : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: {
      "@type": "Person",
      name: article.author_name || "StatsGH Editorial",
      url: baseUrl,
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "StatsGH",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: "https://statsgh.com/social/statsgh-og-1200x630.png",
        width: 1200,
        height: 630,
      },
      sameAs: [
        "https://twitter.com/StatsGH",
        "https://www.facebook.com/StatsGH",
      ],
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    url: articleUrl,
    isAccessibleForFree: true,
    inLanguage: "en",
    keywords: article.tags?.join(", ") || undefined,
    articleSection: article.section || undefined,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { categorySlug, articleSlug } = await params;

  // Check if categorySlug is a valid category - if so, this should be handled by the category page
  if (categorySlug in CATEGORY_MAPPING && !articleSlug) {
    redirect(`/${categorySlug}`);
  }

  const article = await getArticle(categorySlug, articleSlug);

  if (!article) {
    notFound();
  }

  // Redirect to correct category if URL doesn't match
  if (article.category_slug !== categorySlug) {
    redirect(`/${article.category_slug}/${article.slug}`);
  }

  const jsonLd = generateJsonLd(article);

  return (
    <>
      {/* Server-rendered JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Client component for interactivity */}
      <ArticleContent article={article} />
    </>
  );
}
