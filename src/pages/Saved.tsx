import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const Saved = () => {
  const navigate = useNavigate();

  usePageMeta({ robots: "noindex, nofollow" });

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  useEffect(() => {
    if (session === null) {
      navigate("/auth");
    }
  }, [session, navigate]);

  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ["bookmarks", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          `
          id,
          article_id,
          created_at,
          articles (
            id,
            title,
            slug,
            category_slug,
            section,
            summary,
            hero_image_url,
            published_at,
            author_name
          )
        `
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-muted-foreground hover:text-foreground">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground">Saved Articles</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <header className="mb-8 border-b border-border pb-6">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
            Saved Articles
          </h1>
          <p className="mt-2 text-muted-foreground">
            Articles you've bookmarked for later reading
          </p>
        </header>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 py-6 border-b border-border">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="w-32 h-24 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : !bookmarks || bookmarks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-6">
              You haven't saved any articles yet
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Explore Articles
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bookmarks.map((bookmark: any) => {
              const article = bookmark.articles;
              if (!article) return null;
              
              return (
                <article key={bookmark.id} className="py-6">
                  <Link
                    to={`/${article.category_slug}/${article.slug}`}
                    className="group flex gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/${article.category_slug}`}
                        className="text-xs font-bold uppercase tracking-wide text-ft-maroon hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {article.category_slug?.replace(/-/g, " ")}
                      </Link>
                      
                      <h2 className="mt-2 font-serif text-xl font-semibold text-foreground group-hover:text-ft-maroon transition-colors leading-snug line-clamp-2">
                        {article.title}
                      </h2>
                      
                      {article.summary && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {article.summary}
                        </p>
                      )}
                      
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{article.author_name}</span>
                        {article.published_at && (
                          <>
                            <span>•</span>
                            <time dateTime={article.published_at}>
                              {format(new Date(article.published_at), "MMM d, yyyy")}
                            </time>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {article.hero_image_url && (
                      <div className="w-32 md:w-40 flex-shrink-0">
                        <div className="aspect-[4/3] overflow-hidden">
                          <img
                            src={article.hero_image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Saved;
