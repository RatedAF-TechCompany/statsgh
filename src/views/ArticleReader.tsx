"use client";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const ArticleReader = () => {
  const { slug } = useParams();

  const { data: html, isLoading, error } = useQuery({
    queryKey: ["article-reader", slug],
    queryFn: async () => {
      const response = await fetch(
        `https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/article-reader?slug=${slug}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch article");
      }
      return response.text();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/4 mb-8" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <p className="text-muted-foreground">
          The article you're looking for doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  // Render the server-generated HTML directly
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export default ArticleReader;
