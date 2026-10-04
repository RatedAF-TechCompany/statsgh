"use client";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

const AdminCorrections = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  usePageMeta({ robots: "noindex, nofollow" });

  const [articleUrl, setArticleUrl] = useState("");
  const [whatWrong, setWhatWrong] = useState("");
  const [whatFixed, setWhatFixed] = useState("");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["isAdminOrEditor", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["admin", "editor"]);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (!roleLoading && session && !isAdmin) navigate("/");
  }, [isAdmin, roleLoading, session, navigate]);

  const { data: corrections, isLoading } = useQuery({
    queryKey: ["admin-corrections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrections")
        .select("*")
        .order("corrected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const addCorrection = useMutation({
    mutationFn: async () => {
      // Resolve the article from the pasted URL (/<category>/<slug>)
      const match = articleUrl.match(/statsgh\.com\/([^/]+)\/([^/?#]+)/) || articleUrl.match(/^\/([^/]+)\/([^/?#]+)/);
      if (!match) throw new Error("Paste a full article URL like https://www.statsgh.com/economy/some-story");
      const slug = match[2];
      const { data: article, error } = await supabase
        .from("articles")
        .select("id, title, category_slug, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!article) throw new Error("No article found with that URL");
      const { error: insertError } = await supabase.from("corrections").insert({
        article_id: article.id,
        article_title: article.title,
        article_url: `/${article.category_slug}/${article.slug}`,
        what_was_wrong: whatWrong.trim(),
        what_was_fixed: whatFixed.trim(),
        created_by: session!.user.id,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-corrections"] });
      queryClient.invalidateQueries({ queryKey: ["corrections"] });
      setArticleUrl(""); setWhatWrong(""); setWhatFixed("");
      toast.success("Correction published");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCorrection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("corrections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-corrections"] });
      queryClient.invalidateQueries({ queryKey: ["corrections"] });
      toast.success("Correction removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading) return null;
  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#FFFFFF]">
        <Header />
        <main className="max-w-[680px] mx-auto px-4 py-16 text-center">
          <p className="font-ui text-[#5B5B5B]">Admin or editor access required.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header />
      <main className="max-w-[680px] mx-auto px-4 py-8">
        <h1 className="font-headline text-2xl font-bold text-[#121212] mb-6">Manage corrections</h1>

        <div className="border border-[#D9D9D9] p-5 mb-10 space-y-3">
          <h2 className="font-ui text-sm font-bold uppercase tracking-[0.1em] text-[#5B5B5B]">Add a correction</h2>
          <Input
            placeholder="Article URL (https://www.statsgh.com/economy/some-story)"
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            className="font-ui"
          />
          <Textarea
            placeholder="What was wrong (e.g. 'We said inflation was 23.1%')"
            value={whatWrong}
            onChange={(e) => setWhatWrong(e.target.value)}
            className="font-ui"
          />
          <Textarea
            placeholder="What it now says (e.g. 'Inflation was 22.1%')"
            value={whatFixed}
            onChange={(e) => setWhatFixed(e.target.value)}
            className="font-ui"
          />
          <Button
            onClick={() => addCorrection.mutate()}
            disabled={!articleUrl.trim() || !whatWrong.trim() || !whatFixed.trim() || addCorrection.isPending}
            className="font-ui"
          >
            Publish correction
          </Button>
        </div>

        {isLoading ? null : !corrections?.length ? (
          <p className="font-ui text-sm text-[#5B5B5B]">No corrections yet.</p>
        ) : (
          <div className="space-y-4">
            {corrections.map((c) => (
              <div key={c.id} className="border border-[#D9D9D9] p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#5B5B5B] mb-1">
                    {format(new Date(c.corrected_at), "d MMM yyyy")}
                  </div>
                  <div className="font-ui text-sm font-medium text-[#121212]">{c.article_title}</div>
                  <div className="font-ui text-xs text-[#5B5B5B] mt-1">
                    Wrong: {c.what_was_wrong} — Fixed: {c.what_was_fixed}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteCorrection.mutate(c.id)}
                  aria-label="Delete correction"
                >
                  <Trash2 className="h-4 w-4 text-[#E3120B]" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminCorrections;
