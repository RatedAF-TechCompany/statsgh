"use client";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/markets/MarketBits";

const NewsletterPrefs = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [p, setP] = useState<{ email: string; wants_daily: boolean; wants_weekly: boolean; is_active: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(token)) { setLoading(false); return; }
    (supabase as any).rpc("get_newsletter_prefs", { p_token: token }).then(({ data }: any) => { setP(data?.[0] || null); setLoading(false); });
  }, [token]);

  const save = async (daily: boolean, weekly: boolean, active: boolean) => {
    const { data, error } = await (supabase as any).rpc("update_newsletter_prefs", { p_token: token, p_daily: daily, p_weekly: weekly, p_active: active });
    if (error || !data) { setMsg("Could not save. Please try again."); return; }
    setP((x) => x && { ...x, wants_daily: daily, wants_weekly: weekly, is_active: active && (daily || weekly) });
    setMsg(active && (daily || weekly) ? "Preferences saved." : "You are unsubscribed from all StatsGH emails.");
  };

  return (
    <PageShell title="Newsletter preferences">
      {loading ? <p className="text-sm text-[#5B5B5B]">Loading…</p> : !p ? (
        <p className="font-serif text-[17px] text-[#5B5B5B]">This link is invalid or has expired. Use the "manage preferences" link from your signup or any StatsGH email. <Link to="/newsletter" className="underline text-[#E3120B]">Sign up again</Link>.</p>
      ) : (
        <div className="font-ui text-[14px] space-y-3 max-w-[480px]">
          <p>Address: <strong>{p.email}</strong> · Status: {p.is_active ? "subscribed" : "unsubscribed"}</p>
          <label className="flex gap-2"><input type="checkbox" checked={p.wants_daily} onChange={(e) => setP({ ...p, wants_daily: e.target.checked })} /> Morning Brief (daily)</label>
          <label className="flex gap-2"><input type="checkbox" checked={p.wants_weekly} onChange={(e) => setP({ ...p, wants_weekly: e.target.checked })} /> Week in numbers (weekly)</label>
          <div className="flex gap-3">
            <button onClick={() => save(p.wants_daily, p.wants_weekly, true)} className="bg-[#E3120B] text-white font-semibold px-4 h-9">Save</button>
            <button onClick={() => save(false, false, false)} className="border border-[#121212] px-4 h-9">Unsubscribe from all</button>
          </div>
          {msg && <p role="status" className="text-[#5B5B5B]">{msg}</p>}
        </div>
      )}
    </PageShell>
  );
};
export default NewsletterPrefs;
