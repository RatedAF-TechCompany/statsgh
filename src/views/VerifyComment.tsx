"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const VerifyComment = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [articleId, setArticleId] = useState<string | null>(null);

  useEffect(() => {
    const verifyComment = async () => {
      const code = searchParams.get("code");

      if (!code) {
        setStatus("error");
        setMessage("Invalid verification link");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-comment", {
          body: { code },
        });

        if (error) throw error;

        if (data.success) {
          setStatus("success");
          setMessage(data.alreadyVerified 
            ? "This comment has already been verified!" 
            : "Your comment has been verified and published!"
          );
          setArticleId(data.articleId);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch (error: any) {
        console.error("Verification error:", error);
        setStatus("error");
        setMessage(error.message || "Failed to verify comment");
      }
    };

    verifyComment();
  }, [searchParams]);

  const handleViewArticle = async () => {
    if (articleId) {
      // Get article slug
      const { data } = await supabase
        .from("articles")
        .select("slug")
        .eq("id", articleId)
        .single();

      if (data?.slug) {
        router.push(`/article/${data.slug}`);
      } else {
        router.push("/");
      }
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-md mx-auto px-5 py-20 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
            <h2 className="font-serif text-2xl font-bold">Verifying your comment...</h2>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
            <h2 className="font-serif text-2xl font-bold">Success!</h2>
            <p className="text-muted-foreground">{message}</p>
            <Button onClick={handleViewArticle}>
              View Article
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="font-serif text-2xl font-bold">Verification Failed</h2>
            <p className="text-muted-foreground">{message}</p>
            <Button onClick={() => router.push("/")} variant="outline">
              Go Home
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default VerifyComment;