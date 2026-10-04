"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePageMeta } from "@/hooks/usePageMeta";

type Author = { id: string; slug: string; display_name: string; role: string | null; bio: string | null; expertise: string[]; byline_aliases: string[]; kind: string; is_active: boolean; sort_order: number };

const db = supabase as any;

export default function AdminAuthors() {
  usePageMeta({ robots: "noindex, nofollow" });
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Author[]>([]);
  const [bylines, setBylines] = useState<string[]>([]);
  const [pick, setPick] = useState("");

  const load = async () => {
    const { data } = await db.from("authors").select("*").order("sort_order").order("display_name");
    setRows(data || []);
  };
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid) return setAllowed(false);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).in("role", ["admin", "editor"]);
      const ok = (data?.length ?? 0) > 0;
      setAllowed(ok);
      if (ok) {
        load();
        const { data: a } = await db.from("articles").select("author_name").eq("is_published", true).not("author_name", "is", null).order("published_at", { ascending: false }).limit(1000);
        setBylines(Array.from(new Set<string>((a || []).map((r: any) => r.author_name))).sort());
      }
    })();
  }, []);

  const save = async (a: Author) => {
    const { error } = await db.from("authors").update({ display_name: a.display_name, role: a.role, bio: a.bio, expertise: a.expertise, byline_aliases: a.byline_aliases, is_active: a.is_active, sort_order: a.sort_order }).eq("id", a.id);
    error ? toast.error(error.message) : toast.success("Saved");
  };
  const addFromByline = async () => {
    if (!pick) return;
    const slug = pick.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await db.from("authors").insert({ slug, display_name: pick, byline_aliases: [pick], kind: "journalist" });
    if (error) return toast.error(error.message);
    setPick(""); load();
  };
  const upd = (id: string, patch: Partial<Author>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  if (allowed === null) return <div className="p-8 font-ui">Checking access…</div>;
  if (!allowed) return <div className="min-h-screen bg-white"><Header /><p className="p-8 font-ui">Admins and editors only. <a className="underline" href="/auth">Sign in</a></p></div>;
  const unused = bylines.filter((b) => !rows.some((r) => r.byline_aliases.includes(b) || r.display_name === b));
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[1000px] mx-auto px-4 py-8 space-y-6">
        <h1 className="font-headline text-2xl">Author profiles</h1>
        <p className="font-ui text-sm text-[#5B5B5B]">Profiles can only be created from bylines already on published stories. Do not add details you cannot verify.</p>
        <div className="flex gap-2 items-center">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="border px-2 py-1.5 font-ui text-sm max-w-[400px]">
            <option value="">Add profile for an existing byline…</option>
            {unused.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <Button size="sm" onClick={addFromByline} disabled={!pick}>Add</Button>
        </div>
        {rows.map((a) => (
          <div key={a.id} className="border border-[#D9D9D9] p-4 space-y-2">
            <div className="flex flex-wrap gap-2 items-center font-ui text-xs text-[#5B5B5B]"><a className="underline" href={`/authors/${a.slug}`}>/authors/{a.slug}</a> · {a.kind}
              <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={a.is_active} onChange={(e) => upd(a.id, { is_active: e.target.checked })} /> Public</label>
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              <Input value={a.display_name} onChange={(e) => upd(a.id, { display_name: e.target.value })} placeholder="Name" />
              <Input value={a.role || ""} onChange={(e) => upd(a.id, { role: e.target.value })} placeholder="Role" />
              <Input type="number" value={a.sort_order} onChange={(e) => upd(a.id, { sort_order: Number(e.target.value) })} placeholder="Order" />
            </div>
            <Textarea value={a.bio || ""} onChange={(e) => upd(a.id, { bio: e.target.value })} placeholder="Bio" />
            <Input value={a.expertise.join(", ")} onChange={(e) => upd(a.id, { expertise: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Areas of expertise, comma separated" />
            <Input value={a.byline_aliases.join(", ")} onChange={(e) => upd(a.id, { byline_aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Bylines that map to this profile, comma separated" />
            <Button size="sm" onClick={() => save(a)}>Save</Button>
          </div>
        ))}
      </main>
    </div>
  );
}
