import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Bookmark, Share2, TrendingUp, Database, ExternalLink } from "lucide-react";
import { ReadingTime } from "@/components/ReadingTime";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useEffect } from "react";
import DOMPurify from "dompurify";
import { CommentSection } from "@/components/CommentSection";
import { RelatedArticles } from "@/components/RelatedArticles";
import { getSectionLabel } from "@/lib/navigation";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { format } from "date-fns";
import { JournalistByline } from "@/components/JournalistByline";

const ArticleDetail = () => {
  const { articleSlug: slug, categorySlug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["article", slug, categorySlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        await supabase.from("article_views").insert({
          article_id: data.id,
          user_agent: navigator.userAgent,
          referrer: document.referrer,
          device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
        });
      }
      return data;
    },
  });

  const { data: linkedIndicators } = useQuery({
    queryKey: ["article-indicators-display", article?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_indicators")
        .select(`id, cited_value, cited_date, context_note, indicator:indicators(id, name, slug, unit), geography:geographies(id, name, code)`)
        .eq("article_id", article!.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!article?.id,
  });

  const { data: linkedSources } = useQuery({
    queryKey: ["article-sources-display", article?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_sources")
        .select(`id, citation_text, source:data_sources(id, name, short_name, website_url)`)
        .eq("article_id", article!.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!article?.id,
  });

  useEffect(() => {
    if (article) {
      if (!categorySlug || categorySlug !== article.category_slug) {
        navigate(`/${article.category_slug}/${article.slug}`, { replace: true });
      }
    }
  }, [article, categorySlug, slug, navigate]);

  const { data: isBookmarked } = useQuery({
    queryKey: ["bookmark", article?.id, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id || !article?.id) return false;
      const { data } = await supabase.from("bookmarks").select("id").eq("user_id", session.user.id).eq("article_id", article.id).maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id && !!article?.id,
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) { navigate("/auth"); return; }
      if (isBookmarked) {
        const { error } = await supabase.from("bookmarks").delete().eq("user_id", session.user.id).eq("article_id", article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookmarks").insert({ user_id: session.user.id, article_id: article.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", article?.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(isBookmarked ? "Removed from saved" : "Saved article");
    },
  });

  // SEO meta tags
  React.useEffect(() => {
    // Noindex when the slug doesn't resolve to a published article
    if (!isLoading && !article) {
      let robotsTag = document.querySelector('meta[name="robots"]');
      if (!robotsTag) {
        robotsTag = document.createElement('meta');
        robotsTag.setAttribute('name', 'robots');
        document.head.appendChild(robotsTag);
      }
      robotsTag.setAttribute('content', 'noindex, follow');
      document.title = 'Article not found | StatsGH';
      return () => {
        document.title = 'StatsGH';
        robotsTag?.parentNode?.removeChild(robotsTag);
      };
    }

    if (article) {
      // Ensure any prior noindex from a missing-article render is cleared
      const existingRobots = document.querySelector('meta[name="robots"]');
      if (existingRobots && existingRobots.getAttribute('content')?.includes('noindex')) {
        existingRobots.parentNode?.removeChild(existingRobots);
      }
      const canonicalUrl = `https://statsgh.com/${article.category_slug}/${article.slug}`;
      const baseUrl = "https://statsgh.com";
      const makeAbsoluteUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        return `${baseUrl}/${url}`;
      };
      const absoluteImageUrl = makeAbsoluteUrl(article.hero_image_url);

      document.title = `${article.title} | StatsGH`;

      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (!canonicalLink) { canonicalLink = document.createElement('link'); canonicalLink.setAttribute('rel', 'canonical'); document.head.appendChild(canonicalLink); }
      canonicalLink.setAttribute('href', canonicalUrl);

      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) { metaDescription = document.createElement('meta'); metaDescription.setAttribute('name', 'description'); document.head.appendChild(metaDescription); }
      metaDescription.setAttribute('content', article.seo_description || article.summary);

      const ogTags = [
        { property: 'og:title', content: article.title },
        { property: 'og:description', content: article.seo_description || article.summary },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: canonicalUrl },
        { property: 'og:site_name', content: 'StatsGH' },
        ...(absoluteImageUrl ? [{ property: 'og:image', content: absoluteImageUrl }] : []),
        { property: 'article:published_time', content: article.published_at || '' },
        { property: 'article:author', content: article.author_name },
        { property: 'article:section', content: article.section },
      ];
      ogTags.forEach(({ property, content }) => {
        if (!content) return;
        let metaTag = document.querySelector(`meta[property="${property}"]`);
        if (!metaTag) { metaTag = document.createElement('meta'); metaTag.setAttribute('property', property); document.head.appendChild(metaTag); }
        metaTag.setAttribute('content', content);
      });

      const twitterTags = [
        { name: 'twitter:card', content: absoluteImageUrl ? 'summary_large_image' : 'summary' },
        { name: 'twitter:title', content: article.title },
        { name: 'twitter:description', content: article.seo_description || article.summary },
        ...(absoluteImageUrl ? [{ name: 'twitter:image', content: absoluteImageUrl }] : []),
      ];
      twitterTags.forEach(({ name, content }) => {
        if (!content) return;
        let metaTag = document.querySelector(`meta[name="${name}"]`);
        if (!metaTag) { metaTag = document.createElement('meta'); metaTag.setAttribute('name', name); document.head.appendChild(metaTag); }
        metaTag.setAttribute('content', content);
      });

      return () => { document.title = 'StatsGH'; };
    }
  }, [article, isLoading]);

  const handleShare = async () => {
    const url = `https://statsgh.com/${article?.category_slug}/${article?.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: article?.title, text: article?.summary, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); toast.success("Link copied to clipboard"); } catch { toast.error("Failed to copy link"); }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF1E0]">
        <Header />
        <main className="max-w-[680px] mx-auto px-4 py-8">
          <Skeleton className="h-4 w-20 mb-4 skeleton-ft" />
          <Skeleton className="h-10 w-full mb-3 skeleton-ft" />
          <Skeleton className="h-10 w-3/4 mb-6 skeleton-ft" />
          <Skeleton className="h-4 w-48 mb-8 skeleton-ft" />
          <Skeleton className="aspect-[16/9] w-full mb-8 skeleton-ft" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full skeleton-ft" />
            <Skeleton className="h-4 w-full skeleton-ft" />
            <Skeleton className="h-4 w-3/4 skeleton-ft" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#FFF1E0]">
        <Header />
        <main className="max-w-[680px] mx-auto px-4 py-16 text-center">
          <h1 className="font-headline text-3xl font-bold text-[#33302E] mb-4">Article not found</h1>
          <p className="text-[#66605A] mb-8">The article you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/")} variant="outline" className="font-ui border-[#E8D9C5]">Return to Homepage</Button>
        </main>
      </div>
    );
  }

  const sanitizedBody = DOMPurify.sanitize(article.body, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'img', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style']
  });

  const highlightNumbers = (html: string) => {
    return html.replace(
      /\b(\d+(?:[.,]\d+)*(?:\s*%|°C|°F|km|m|kg|g|bn|mn|tn|\$|£|€|¢|GH₵)?)\b/g,
      '<span class="number-highlight">$1</span>'
    );
  };

  const bodyWithHighlightedNumbers = highlightNumbers(sanitizedBody);
  const sectionLabel = getSectionLabel(article.category_slug);

  return (
    <div className="min-h-screen bg-[#FFF1E0]">
      <Header />

      {/* Share bar — fixed on left for desktop */}
      <div className="hidden lg:flex fixed left-4 top-1/3 flex-col gap-3 z-40">
        <button
          onClick={handleShare}
          className="w-10 h-10 flex items-center justify-center border border-[#E8D9C5] bg-[#FFFAF4] hover:bg-[#E8D9C5] transition-colors"
          title="Share"
          aria-label="Share article"
        >
          <Share2 size={16} className="text-[#33302E]" />
        </button>
        <button
          onClick={() => toggleBookmark.mutate()}
          className="w-10 h-10 flex items-center justify-center border border-[#E8D9C5] bg-[#FFFAF4] hover:bg-[#E8D9C5] transition-colors"
          title="Save"
          aria-label={isBookmarked ? "Remove from saved articles" : "Save article"}
          aria-pressed={isBookmarked}
        >
          <Bookmark size={16} className="text-[#33302E]" fill={isBookmarked ? "#33302E" : "none"} />
        </button>
      </div>

      <main className="max-w-[680px] mx-auto px-4 py-6 lg:py-10">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList className="font-ui text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-[#66605A] hover:text-[#0D7680]">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/${article.category_slug}`} className="text-[#66605A] hover:text-[#0D7680] capitalize">
                  {sectionLabel}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-[#33302E] line-clamp-1 max-w-[200px]">{article.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <article itemScope itemType="https://schema.org/NewsArticle">
          {/* Section label */}
          <Link to={`/${article.category_slug}`} className="section-label hover:underline mb-3 inline-block">
            {sectionLabel}
          </Link>

          {/* Headline */}
          <h1 className="font-headline text-[32px] md:text-[38px] font-bold leading-[1.15] text-[#33302E] mb-4" itemProp="headline">
            {article.title}
          </h1>

          {/* Subtitle */}
          {article.subtitle && (
            <p className="font-serif text-xl text-[#66605A] leading-relaxed mb-5" itemProp="description">
              {article.subtitle}
            </p>
          )}

          {/* Byline */}
          <div className="border-t border-b border-[#E8D9C5] py-3 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-ui text-[13px] text-[#66605A]" itemProp="author">
                  <JournalistByline name={article.author_name} />
                  {" "}|{" "}StatsGH
                  {article.published_at && (
                    <> | <time dateTime={article.published_at} itemProp="datePublished">
                      {format(new Date(article.published_at), "MMMM d, yyyy")}
                    </time></>
                  )}
                </span>
                <div className="font-ui text-xs text-[#66605A] mt-1">
                  <ReadingTime content={article.body} />
                </div>
              </div>
              {/* Mobile share buttons */}
              <div className="flex items-center gap-1 lg:hidden">
                <button onClick={handleShare} className="p-2 hover:opacity-70" aria-label="Share article">
                  <Share2 size={16} className="text-[#66605A]" />
                </button>
                <button
                  onClick={() => toggleBookmark.mutate()}
                  className="p-2 hover:opacity-70"
                  aria-label={isBookmarked ? "Remove from saved articles" : "Save article"}
                  aria-pressed={isBookmarked}
                >
                  <Bookmark size={16} className="text-[#66605A]" fill={isBookmarked ? "#33302E" : "none"} />
                </button>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          {article.hero_image_url && (
            <figure className="mb-10">
              <img src={article.hero_image_url} alt={article.title} className="w-full aspect-[16/9] object-cover" itemProp="image" />
            </figure>
          )}

          {/* Article Body */}
          <section
            data-article-body="true"
            className="prose prose-lg max-w-none mb-8"
            itemProp="articleBody"
            dangerouslySetInnerHTML={{ __html: bodyWithHighlightedNumbers }}
          />

          {/* Comments */}
          <div className="mb-12">
            <CommentSection articleId={article.id} />
          </div>

          {/* Video */}
          {article.video_url && (
            <div className="mb-10">
              <h2 className="font-headline text-xl font-bold mb-4 text-[#33302E] border-b border-[#E8D9C5] pb-2">Video</h2>
              <div className="aspect-video"><iframe src={article.video_url} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
            </div>
          )}

          {/* Audio */}
          {article.audio_url && (
            <div className="mb-10">
              <h2 className="font-headline text-xl font-bold mb-4 text-[#33302E] border-b border-[#E8D9C5] pb-2">Listen</h2>
              <audio controls className="w-full"><source src={article.audio_url} type="audio/mpeg" /></audio>
            </div>
          )}
        </article>

        {/* Data Citations */}
        {((linkedIndicators && linkedIndicators.length > 0) || (linkedSources && linkedSources.length > 0)) && (
          <aside className="my-12 border-t border-b border-[#E8D9C5] py-8">
            <h2 className="font-headline text-xl font-bold mb-6 flex items-center gap-2 text-[#33302E]">
              <Database className="h-5 w-5 text-[#66605A]" />
              Data sources
            </h2>
            {linkedIndicators && linkedIndicators.length > 0 && (
              <div className="mb-8">
                <h3 className="font-ui text-xs font-bold uppercase tracking-[0.12em] text-[#66605A] mb-4 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" /> Indicators cited
                </h3>
                <div className="space-y-3">
                  {linkedIndicators.map((item: any) => (
                    <div key={item.id} className="flex items-start justify-between p-4 bg-[#FFFAF4] border border-[#E8D9C5]">
                      <div className="flex-1">
                        <Link to={`/data/${item.indicator?.slug}`} className="font-medium text-[#33302E] hover:text-[#0D7680] hover:underline">
                          {item.indicator?.name}
                        </Link>
                        <div className="font-ui text-sm text-[#66605A] mt-1 flex flex-wrap gap-x-2">
                          {item.cited_value !== null && <span className="font-mono font-bold text-[#33302E]">{item.cited_value.toLocaleString()} {item.indicator?.unit}</span>}
                          {item.cited_date && <span>{new Date(item.cited_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>}
                          {item.geography && <span>{item.geography.name}</span>}
                        </div>
                        {item.context_note && <p className="font-ui text-xs text-[#66605A] mt-1 italic">{item.context_note}</p>}
                      </div>
                      <Link to={`/data/${item.indicator?.slug}`}><Button size="sm" variant="ghost" className="text-[#66605A] hover:text-[#0D7680]"><ExternalLink className="h-3.5 w-3.5" /></Button></Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {linkedSources && linkedSources.length > 0 && (
              <div>
                <h4 className="font-ui text-xs font-bold uppercase tracking-[0.12em] text-[#66605A] mb-4">Sources</h4>
                <div className="flex flex-wrap gap-2">
                  {linkedSources.map((item: any) => (
                    <button key={item.id} onClick={() => item.source?.website_url && window.open(item.source.website_url, "_blank")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 font-ui text-sm border border-[#E8D9C5] bg-[#FFFAF4] hover:bg-[#E8D9C5] transition-colors">
                      <span className="font-medium">{item.source?.short_name || item.source?.name}</span>
                      {item.citation_text && <span className="text-[#66605A]">– {item.citation_text}</span>}
                      {item.source?.website_url && <ExternalLink className="h-3 w-3 text-[#66605A]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Related Articles */}
        <RelatedArticles articleId={article.id} tags={article.tags} categorySlug={article.category_slug} maxItems={3} />
      </main>

      <Footer />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "NewsArticle",
          "headline": article.title,
          "description": article.seo_description || article.summary,
          "image": article.hero_image_url,
          "datePublished": article.published_at,
          "dateModified": article.updated_at,
          "author": { "@type": "Person", "name": article.author_name },
          "publisher": { "@type": "Organization", "name": "StatsGH", "logo": { "@type": "ImageObject", "url": "https://statsgh.com/social/statsgh-og-1200x630.png" } },
          "mainEntityOfPage": { "@type": "WebPage", "@id": `https://statsgh.com/${article.category_slug}/${article.slug}` }
        })
      }} />
    </div>
  );
};

export default ArticleDetail;
