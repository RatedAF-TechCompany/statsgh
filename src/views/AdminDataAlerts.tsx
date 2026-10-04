"use client";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";
import { z } from "zod";

const schema = z.object({
  message: z.string().trim().min(3, "Message is too short").max(200, "Keep it under 200 characters"),
  link_url: z.string().trim().max(500).refine((v) => !v || /^(https:\/\/|\/)/.test(v), "Link must start with https:// or /").optional(),
});

const AdminDataAlerts = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  usePageMeta({ robots: "noindex, nofollow" });
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  const { data: allowed, isLoading: roleLoading } = useQuery({
    queryKey: ["isAdminOrEditor", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session!.user.id).in("role", ["admin", "editor"]);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!session?.user?.id,
  });
  useEffect(() => { if (!roleLoading && session && !allowed) navigate("/"); }, [allowed, roleLoading, session, navigate]);
  useEffect(() => { if (session === null) navigate("/auth"); }, [session, navigate]);

  const { data: alerts } = useQuery({
    queryKey: ["admin-data-alerts"],
    queryFn: async () => (await supabase.from("data_alerts").select("*").order("created_at", { ascending: false })).data || [],
    enabled: !!allowed,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-data-alerts"] }); qc.invalidateQueries({ queryKey: ["data-alert"] }); };

  const add = useMutation({
    mutationFn: async () => {
      const v = schema.parse({ message, link_url: link });
      const { error } = await supabase.from("data_alerts").insert({ message: v.message, link_url: v.link_url || null, is_active: false, created_by: session?.user.id });
      if (error) throw error;
    },
    onSuccess: () => { setMessage(""); setLink(""); refresh(); toast.success("Alert saved (off). Switch it on to show it."); },
    onError: (e: any) => toast.error(e?.issues?.[0]?.message || e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase.from("data_alerts").update({ is_active: on }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("data_alerts").delete().eq("id", id); if (error) throw error; },
    onSuccess: refresh,
  });

  if (!allowed) return null;
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="font-serif text-3xl font-bold">Data Alerts</h1>
        <p className="text-sm text-[#5B5B5B]">A switched-on alert shows as a red banner at the top of every page. Only the newest active alert is shown.</p>
        <div className="space-y-2">
          <Input placeholder="e.g. Inflation falls to 5.0% in August" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} />
          <Input placeholder="Link (optional), e.g. /economy/story-slug" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} />
          <Button onClick={() => add.mutate()} disabled={add.isPending}>Save alert</Button>
        </div>
        <ul className="divide-y border-t border-b">
          {(alerts || []).map((a: any) => (
            <li key={a.id} className="py-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold">{a.message}</p>
                {a.link_url && <p className="text-xs text-[#5B5B5B]">{a.link_url}</p>}
              </div>
              <Button size="sm" variant={a.is_active ? "destructive" : "default"} onClick={() => toggle.mutate({ id: a.id, on: !a.is_active })}>
                {a.is_active ? "Switch off" : "Switch on"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>Delete</Button>
            </li>
          ))}
          {alerts?.length === 0 && <li className="py-3 text-sm text-[#5B5B5B]">No alerts yet.</li>}
        </ul>
      </main>
    </div>
  );
};

export default AdminDataAlerts;
