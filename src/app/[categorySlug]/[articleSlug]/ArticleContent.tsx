"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Bookmark, Share2, TrendingUp, Database, ExternalLink } from "lucide-react";
import { ListenButton } from "@/components/ListenButton";
import { ReadingTime } from "@/components/ReadingTime";
import { toast } from "sonner";
import createDOMPurify from "dompurify";
import { CommentSection } from "@/components/CommentSection";
import { RelatedArticles } from "@/components/RelatedArticles";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { format } from "date-fns";

interface ArticleContentProps {
  article: {
    id: string;
    title: string;
    slug: string;
    category_slug: string;
    section: string | null;
    subtitle: string | null;
    summary: string | null;
    body: string;
    hero_image_url: string | null;
    video_url: string | null;
    audio_url: string | null;
    author_name: string;
    published_at: string | null;
    updated_at: string | null;
    tags: string[] | null;
    seo_description: string | null;
  };
}

export default function ArticleContent({ article }: ArticleContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Track view on mount
  useEffect(() => {
    const trackView = async () => {
      try {
        await fetch("/api/track-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId: article.id,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
          }),
        });
      } catch (error) {
        // Silent fail for view tracking
      }
    };
    trackView();
  }, [article.id]);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: linkedIndicators } = useQuery({
    queryKey: ["article-indicators-display", article.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_indicators")
        .select(`
          id, cited_value, cited_date, context_note,
          indicator:indicators(id, name, slug, unit),
          geography:geographies(id, name, code)
        `)
        .eq("article_id", article.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: linkedSources } = useQuery({
    queryKey: ["article-sources-display", article.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_sources")
        .select(`
          id, citation_text,
          source:data_sources(id, name, short_name, website_url)
        `)
        .eq("article_id", article.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: isBookmarked } = useQuery({
    queryKey: ["bookmark", article.id, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("article_id", article.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) {
        router.push("/auth");
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
      queryClient.invalidateQueries({ queryKey: ["bookmark", article.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(isBookmarked ? "Removed from saved" : "Saved article");
    },
  });

  const handleShare = async () => {
    const url = `https://statsgh.com/${article.category_slug}/${article.slug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.summary || "",
          url: url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      } catch (err) {
        toast.error("Failed to copy link");
      }
    }
  };

  const sanitizedBody = useMemo(() => {
    if (typeof window === "undefined") {
      // Avoid SSR crash; client will sanitize on hydration.
      return article.body;
    }
    const DOMPurify = createDOMPurify(window);
    return DOMPurify.sanitize(article.body, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "u", "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "a", "blockquote", "code", "pre", "img", "span"
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class", "style"],
    });
  }, [article.body]);

  const highlightNumbers = (html: string) => {
    return html.replace(
      /\b(\d+(?:[.,]\d+)*(?:\s*%|°C|°F|km|m|kg|g|bn|mn|tn|\$|£|€|¢|GH₵)?)\b/g,
      '<span class="number-highlight">$1</span>'
    );
  };

  const bodyWithHighlightedNumbers = highlightNumbers(sanitizedBody);
  const formattedCategory = article.category_slug?.replace(/-/g, " ");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        {/* Breadcrumb Navigation */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href={`/${article.category_slug}`}
                  className="text-muted-foreground hover:text-foreground capitalize"
                >
                  {formattedCategory}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground line-clamp-1 max-w-[200px]">
                {article.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <article>
          {/* Category Label */}
          <Link
            href={`/${article.category_slug}`}
            className="inline-block text-xs font-bold tracking-wide uppercase text-ft-maroon hover:underline mb-4"
          >
            {formattedCategory}
          </Link>

          {/* Headline */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-[2.75rem] font-semibold leading-tight text-foreground mb-4">
            {article.title}
          </h1>

          {/* Subtitle/Standfirst */}
          {article.subtitle && (
            <p className="font-serif text-xl md:text-2xl text-muted-foreground leading-relaxed mb-6">
              {article.subtitle}
            </p>
          )}

          {/* Summary/Lede */}
          {article.summary && (
            <p className="text-lg text-foreground leading-relaxed mb-6 font-medium">
              {article.summary}
            </p>
          )}

          {/* Byline & Meta Bar */}
          <div className="border-t border-b border-border py-4 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{article.author_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {article.published_at && (
                    <time dateTime={article.published_at}>
                      {format(new Date(article.published_at), "MMMM d, yyyy")}
                    </time>
                  )}
                  <span>•</span>
                  <ReadingTime content={article.body} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <ListenButton title={article.title} content={article.body} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleBookmark.mutate()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Bookmark
                    className="h-4 w-4"
                    fill={isBookmarked ? "currentColor" : "none"}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          {article.hero_image_url && (
            <figure className="mb-10">
              <img
                src={article.hero_image_url}
                alt={article.title}
                className="w-full aspect-[16/9] object-cover"
              />
            </figure>
          )}

          {/* Article Body */}
          <div
            className="prose prose-lg max-w-none mb-6"
            dangerouslySetInnerHTML={{ __html: bodyWithHighlightedNumbers }}
          />

          {/* Comments Section - Immediately after article */}
          <div className="mb-12">
            <CommentSection articleId={article.id} />
          </div>

          {/* Video Embed */}
          {article.video_url && (
            <div className="mb-10">
              <h3 className="font-serif text-xl font-semibold mb-4 text-foreground border-b border-border pb-2">
                Video
              </h3>
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

          {/* Audio Player */}
          {article.audio_url && (
            <div className="mb-10">
              <h3 className="font-serif text-xl font-semibold mb-4 text-foreground border-b border-border pb-2">
                Listen to this article
              </h3>
              <audio controls className="w-full">
                <source src={article.audio_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </article>

        {/* Data Citations Section */}
        {((linkedIndicators && linkedIndicators.length > 0) ||
          (linkedSources && linkedSources.length > 0)) && (
          <aside className="my-12 border-t border-b border-border py-8">
            <h3 className="font-serif text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
              <Database className="h-5 w-5 text-muted-foreground" />
              Data Sources
            </h3>

            {linkedIndicators && linkedIndicators.length > 0 && (
              <div className="mb-8">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Indicators Cited
                </h4>
                <div className="space-y-3">
                  {linkedIndicators.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-4 bg-muted/40 border border-border"
                    >
                      <div className="flex-1">
                        <Link
                          href={`/data/${item.indicator?.slug}`}
                          className="font-medium text-foreground hover:text-ft-maroon hover:underline"
                        >
                          {item.indicator?.name}
                        </Link>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                          {item.cited_value !== null && (
                            <span className="font-mono font-medium text-foreground">
                              {item.cited_value.toLocaleString()} {item.indicator?.unit}
                            </span>
                          )}
                          {item.cited_date && (
                            <span>
                              {new Date(item.cited_date).toLocaleDateString("en-GB", {
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          )}
                          {item.geography && <span>{item.geography.name}</span>}
                        </div>
                        {item.context_note && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {item.context_note}
                          </p>
                        )}
                      </div>
                      <Link href={`/data/${item.indicator?.slug}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {linkedSources && linkedSources.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                  Sources
                </h4>
                <div className="flex flex-wrap gap-2">
                  {linkedSources.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.source?.website_url) {
                          window.open(item.source.website_url, "_blank");
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border bg-background hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">
                        {item.source?.short_name || item.source?.name}
                      </span>
                      {item.citation_text && (
                        <span className="text-muted-foreground">– {item.citation_text}</span>
                      )}
                      {item.source?.website_url && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Related Articles */}
        <RelatedArticles
          articleId={article.id}
          tags={article.tags}
          categorySlug={article.category_slug}
          maxItems={6}
        />
      </main>
    </div>
  );
}
