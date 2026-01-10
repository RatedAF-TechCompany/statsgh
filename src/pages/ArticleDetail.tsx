import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bookmark, Share2, ArrowLeft, TrendingUp, Database, ExternalLink } from "lucide-react";
import { ListenButton } from "@/components/ListenButton";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { CommentSection } from "@/components/CommentSection";

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
      
      // Track view only if article exists
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

  // Fetch linked indicators
  const { data: linkedIndicators } = useQuery({
    queryKey: ["article-indicators-display", article?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_indicators")
        .select(`
          id, cited_value, cited_date, context_note,
          indicator:indicators(id, name, slug, unit),
          geography:geographies(id, name, code)
        `)
        .eq("article_id", article!.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!article?.id,
  });

  // Fetch linked sources
  const { data: linkedSources } = useQuery({
    queryKey: ["article-sources-display", article?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_sources")
        .select(`
          id, citation_text,
          source:data_sources(id, name, short_name, website_url)
        `)
        .eq("article_id", article!.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!article?.id,
  });

  // Handle redirects for legacy URLs and mismatched category slugs
  useEffect(() => {
    if (article) {
      // If coming from legacy /article/:slug URL or wrong category slug
      if (!categorySlug || categorySlug !== article.category_slug) {
        // 301 redirect to new URL structure
        navigate(`/${article.category_slug}/${article.slug}`, { replace: true });
      }
    }
  }, [article, categorySlug, slug, navigate]);

  const { data: isBookmarked } = useQuery({
    queryKey: ["bookmark", article?.id, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id || !article?.id) return false;
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("article_id", article.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id && !!article?.id,
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) {
        navigate("/auth");
        return;
      }

      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", session.user.id)
          .eq("article_id", article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: session.user.id, article_id: article.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", article?.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(isBookmarked ? "Removed from saved" : "Saved article");
    },
  });

  // Update document head with meta tags - MUST be before early returns
  React.useEffect(() => {
    if (article) {
      const canonicalUrl = `https://statsgh.com/${article.category_slug}/${article.slug}`;
      const baseUrl = "https://statsgh.com";
      
      // Helper to make URLs absolute
      const makeAbsoluteUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        return `${baseUrl}/${url}`;
      };

      const absoluteImageUrl = makeAbsoluteUrl(article.hero_image_url);
      const absoluteVideoUrl = makeAbsoluteUrl(article.video_url);
      const absoluteAudioUrl = makeAbsoluteUrl(article.audio_url);

      // Update page title
      document.title = `${article.title} - StatsGH`;
      
      // Update or create canonical link
      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', canonicalUrl);

      // Update or create meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', article.seo_description || article.summary);

      // Update or create Open Graph meta tags
      const ogTags = [
        { property: 'og:title', content: article.title },
        { property: 'og:description', content: article.seo_description || article.summary },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: canonicalUrl },
        { property: 'og:site_name', content: 'StatsGH' },
        ...(absoluteImageUrl ? [
          { property: 'og:image', content: absoluteImageUrl },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' }
        ] : []),
        ...(absoluteVideoUrl ? [{ property: 'og:video', content: absoluteVideoUrl }] : []),
        ...(absoluteAudioUrl ? [{ property: 'og:audio', content: absoluteAudioUrl }] : []),
        { property: 'article:published_time', content: article.published_at || '' },
        { property: 'article:modified_time', content: article.updated_at || '' },
        { property: 'article:author', content: article.author_name },
        { property: 'article:section', content: article.section },
      ];

      ogTags.forEach(({ property, content }) => {
        if (!content) return;
        let metaTag = document.querySelector(`meta[property="${property}"]`);
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('property', property);
          document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', content);
      });

      // Update or create Twitter Card meta tags
      const twitterTags = [
        { name: 'twitter:card', content: absoluteVideoUrl ? 'player' : (absoluteImageUrl ? 'summary_large_image' : 'summary') },
        { name: 'twitter:title', content: article.title },
        { name: 'twitter:description', content: article.seo_description || article.summary },
        ...(absoluteImageUrl ? [{ name: 'twitter:image', content: absoluteImageUrl }] : []),
        ...(absoluteVideoUrl ? [{ name: 'twitter:player', content: absoluteVideoUrl }] : []),
      ];

      twitterTags.forEach(({ name, content }) => {
        if (!content) return;
        let metaTag = document.querySelector(`meta[name="${name}"]`);
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute('name', name);
          document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', content);
      });

      // Cleanup function to reset document title when component unmounts
      return () => {
        document.title = 'StatsGH';
      };
    }
  }, [article]);

  const handleShare = async () => {
    const url = `https://statsgh.com/${article?.category_slug}/${article?.slug}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          text: article?.summary,
          url: url,
        });
      } catch (err) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      } catch (err) {
        toast.error("Failed to copy link");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="h-96 w-full mb-8" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold mb-4">Article not found</h1>
            <Button onClick={() => navigate("/")}>Go to Home</Button>
          </div>
        </main>
      </div>
    );
  }

  const sanitizedBody = DOMPurify.sanitize(article.body, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'img', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style']
  });

  // Highlight numbers in the article body with a subtle pen-style effect
  const highlightNumbers = (html: string) => {
    return html.replace(
      /\b(\d+(?:[.,]\d+)*(?:\s*%|°C|°F|km|m|kg|g|bn|mn|tn|\$|£|€|¢|GH₵)?)\b/g,
      '<span class="number-highlight">$1</span>'
    );
  };

  const bodyWithHighlightedNumbers = highlightNumbers(sanitizedBody);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <article>
          <div className="mb-2 text-sm font-bold text-ft-maroon uppercase">
            {article.section}
          </div>

          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4 text-ft-maroon">
            {article.title}
          </h1>

          {article.subtitle && (
            <p className="text-xl text-ft-maroon mb-4 font-serif">
              {article.subtitle}
            </p>
          )}

          <div className="flex items-center justify-between mb-6 text-sm text-ft-maroon">
            <div>
              <span className="font-medium">{article.author_name}</span>
              {article.published_at && (
                <span className="ml-2">
                  {new Date(article.published_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <ListenButton 
                title={article.title} 
                content={article.body} 
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleBookmark.mutate()}
              >
                <Bookmark
                  className="h-4 w-4"
                  fill={isBookmarked ? "currentColor" : "none"}
                />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {article.hero_image_url && (
            <img
              src={article.hero_image_url}
              alt={article.title}
              className="w-full aspect-video object-cover mb-6"
            />
          )}

          <div 
            className="prose prose-lg max-w-none mb-8 text-foreground"
            dangerouslySetInnerHTML={{ __html: bodyWithHighlightedNumbers }}
          />

          {article.video_url && (
            <div className="mb-8">
              <h3 className="font-serif text-xl font-bold mb-3 text-ft-maroon">Video</h3>
              <div className="aspect-video">
                <iframe
                  src={article.video_url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {article.audio_url && (
            <div className="mb-8">
              <h3 className="font-serif text-xl font-bold mb-3 text-ft-maroon">Audio</h3>
              <audio controls className="w-full">
                <source src={article.audio_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </article>

        {/* Data Citations Section */}
        {((linkedIndicators && linkedIndicators.length > 0) || (linkedSources && linkedSources.length > 0)) && (
          <div className="mt-8 p-6 bg-muted/30 rounded-lg border">
            <h3 className="font-serif text-xl font-bold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Used in This Story
            </h3>
            
            {linkedIndicators && linkedIndicators.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Indicators Cited
                </h4>
                <div className="space-y-2">
                  {linkedIndicators.map((item: any) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-background rounded border"
                    >
                      <div>
                        <Link 
                          to={`/data/${item.indicator?.slug}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {item.indicator?.name}
                        </Link>
                        <div className="text-sm text-muted-foreground mt-1">
                          {item.cited_value !== null && (
                            <span className="font-mono mr-2">
                              {item.cited_value.toLocaleString()} {item.indicator?.unit}
                            </span>
                          )}
                          {item.cited_date && (
                            <span>• {new Date(item.cited_date).toLocaleDateString("en-GB", { 
                              month: "short", 
                              year: "numeric" 
                            })}</span>
                          )}
                          {item.geography && (
                            <span> • {item.geography.name}</span>
                          )}
                          {item.context_note && (
                            <span className="text-xs ml-2">({item.context_note})</span>
                          )}
                        </div>
                      </div>
                      <Link to={`/data/${item.indicator?.slug}`}>
                        <Button size="sm" variant="ghost">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {linkedSources && linkedSources.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                  Data Sources
                </h4>
                <div className="flex flex-wrap gap-2">
                  {linkedSources.map((item: any) => (
                    <Badge 
                      key={item.id} 
                      variant="outline" 
                      className="py-1.5 px-3 cursor-pointer hover:bg-muted"
                      onClick={() => {
                        if (item.source?.website_url) {
                          window.open(item.source.website_url, "_blank");
                        }
                      }}
                    >
                      {item.source?.short_name || item.source?.name}
                      {item.citation_text && (
                        <span className="text-muted-foreground ml-1">
                          – {item.citation_text}
                        </span>
                      )}
                      {item.source?.website_url && (
                        <ExternalLink className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comments Section */}
        <div className="mt-12 border-t border-border pt-8">
          <CommentSection articleId={article.id} />
        </div>
      </main>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": article.title,
            "description": article.seo_description || article.summary,
            "image": article.hero_image_url ? `https://statsgh.com${article.hero_image_url.startsWith('/') ? article.hero_image_url : `/${article.hero_image_url}`}` : undefined,
            "datePublished": article.published_at,
            "dateModified": article.updated_at,
            "author": {
              "@type": "Person",
              "name": article.author_name
            },
            "publisher": {
              "@type": "Organization",
              "name": "StatsGH",
              "logo": {
                "@type": "ImageObject",
                "url": "https://statsgh.com/social/statsgh-og-1200x630.png"
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `https://statsgh.com/${article.category_slug}/${article.slug}`
            }
          })
        }}
      />
    </div>
  );
};

export default ArticleDetail;
