"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { usePageMeta } from "@/hooks/usePageMeta";

type Status = "pending" | "approved" | "rejected";
type Row = { id: string; name: string; email: string; body: string; created_at: string; moderation_status: Status; moderated_at: string | null; article_id: string;
  articles: { title: string; slug: string; category_slug: string | null } | null };

const AdminComments = () => {
  usePageMeta({ robots: "noindex, nofollow" });
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");

  const { data: session, isLoading: sLoading } = useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  const { data: isMod, isLoading: rLoading } = useQuery({
    queryKey: ["isAdminOrEditor", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session!.user.id).in("role", ["admin", "editor"]);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!session?.user?.id,
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-comments", tab],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("comments")
        .select("id,name,email,body,created_at,moderation_status,moderated_at,article_id,articles(title,slug,category_slug)")
        .eq("moderation_status", tab).order("created_at", { ascending: tab === "pending" }).limit(200);
      if (error) throw error;
      return data as Row[];
    },
    enabled: !!isMod,
  });

  const moderate = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "pending" }) => {
      const { error } = await (supabase as any).rpc("sg_moderate_comment", { p_id: id, p_action: action });
      if (error) throw error;
      return action;
    },
    onSuccess: (a) => { qc.invalidateQueries({ queryKey: ["admin-comments"] }); toast.success(a === "approve" ? "Comment published" : a === "reject" ? "Comment rejected (kept, not shown)" : "Moved back to pending"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (sLoading || (session && rLoading)) return null;
  if (!session || !isMod) {
    return (
      <div className="min-h-screen bg-white"><Header />
        <main className="max-w-[680px] mx-auto px-4 py-16 text-center">
          <p className="font-ui text-[#5B5B5B]">Admin or editor access required. <a className="underline text-[#E3120B]" href="/auth">Sign in</a></p>
        </main>
      </div>
    );
  }

  const btn = "font-ui text-[13px] font-semibold px-3 h-8 border";
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[820px] mx-auto px-4 py-8">
        <h1 className="font-headline text-2xl font-bold text-[#121212] mb-2">Comment moderation</h1>
        <p className="font-ui text-[14px] text-[#5B5B5B] mb-6">Nothing appears on the site until you approve it. Rejected comments are kept (not deleted) and never shown.</p>
        <div className="flex gap-2 mb-6" role="tablist">
          {(["pending", "approved", "rejected"] as Status[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`${btn} capitalize ${tab === t ? "bg-[#121212] text-white border-[#121212]" : "border-[#D9D9D9]"}`}>{t}</button>
          ))}
        </div>
        {isLoading ? <p className="font-ui text-[#5B5B5B]">Loading…</p> : !rows?.length ? (
          <p className="font-ui text-[#5B5B5B]">No {tab} comments.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((c) => (
              <li key={c.id} className="border border-[#D9D9D9] p-4">
                <div className="font-ui text-[12px] text-[#5B5B5B] mb-1">
                  {new Date(c.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })} (UK) · <strong className="text-[#121212]">{c.name}</strong> · {c.email}
                </div>
                {c.articles && (
                  <a className="font-ui text-[13px] underline text-[#E3120B]" target="_blank" rel="noreferrer"
                    href={`/${c.articles.category_slug || "news"}/${c.articles.slug}#comments`}>{c.articles.title}</a>
                )}
                <p className="font-serif text-[16px] whitespace-pre-wrap my-3">{c.body}</p>
                <div className="flex gap-2">
                  {tab !== "approved" && <button disabled={moderate.isPending} onClick={() => moderate.mutate({ id: c.id, action: "approve" })} className={`${btn} bg-[#0B7A3E] text-white border-[#0B7A3E]`}>Approve</button>}
                  {tab !== "rejected" && <button disabled={moderate.isPending} onClick={() => moderate.mutate({ id: c.id, action: "reject" })} className={`${btn} border-[#B30E08] text-[#B30E08]`}>Reject</button>}
                  {tab !== "pending" && <button disabled={moderate.isPending} onClick={() => moderate.mutate({ id: c.id, action: "pending" })} className={`${btn} border-[#D9D9D9]`}>Back to pending</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
export default AdminComments;
