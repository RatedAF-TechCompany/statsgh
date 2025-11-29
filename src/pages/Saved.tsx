import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

const Saved = () => {
  const navigate = useNavigate();

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
          articles (
            id,
            title,
            slug,
            category_slug,
            section,
            summary,
            hero_image_url
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

      <main className="max-w-2xl mx-auto">
        <div className="px-4 pt-4">
          <h2 className="font-sans text-2xl font-medium mb-2">Saved Articles</h2>
          <div className="border-b border-divider mb-4" />
        </div>

        {isLoading ? (
          <div className="space-y-4 px-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : !bookmarks || bookmarks.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-text mb-4">You have no saved articles yet</p>
            <Button onClick={() => navigate("/")} variant="outline">
              Explore Articles
            </Button>
          </div>
        ) : (
          bookmarks.map((bookmark: any) => (
            <ArticleCard key={bookmark.id} article={bookmark.articles} />
          ))
        )}
      </main>
    </div>
  );
};

export default Saved;
