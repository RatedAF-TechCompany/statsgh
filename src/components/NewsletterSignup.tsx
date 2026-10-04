"use client";
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const NewsletterSignup = ({ source = "footer" }: { source?: string }) => {
  const [email, setEmail] = useState("");
  const [daily, setDaily] = useState(true);
  const [weekly, setWeekly] = useState(true);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || value.length > 254) { setState("error"); setMsg("Please enter a valid email address."); return; }
    if (!daily && !weekly) { setState("error"); setMsg("Choose the Morning Brief, Week in numbers, or both."); return; }
    setState("saving");
    const { data, error } = await (supabase as any).rpc("subscribe_newsletter", { p_email: value, p_daily: daily, p_weekly: weekly, p_source: source });
    if (error) { setState("error"); setMsg("Could not sign you up. Please try again."); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setToken(row?.manage_token || null);
    setState("done");
    setMsg(row?.status === "existing" ? "This address is already subscribed; we've added your choices." : "You're signed up. Emails start once our mailing service is switched on.");
    setEmail("");
  };

  return (
    <form onSubmit={submit} className="mt-6" aria-label="Newsletter signup">
      <h3 className="kicker mb-2">StatsGH newsletters</h3>
      <div className="flex flex-col gap-1 mb-2 font-ui text-[13px] text-[#333]">
        <label className="flex gap-2 items-start"><input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} className="mt-1" /><span><strong>Morning Brief</strong> (daily): cedi rates, GSE movers, top stories, key number.</span></label>
        <label className="flex gap-2 items-start"><input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} className="mt-1" /><span><strong>Week in numbers</strong> (Sundays): the week's figures that mattered.</span></label>
      </div>
      <div className="flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address"
          className="flex-1 min-w-0 border border-[#D9D9D9] px-3 h-9 font-ui text-[13px]" />
        <button type="submit" disabled={state === "saving"} className="bg-[#E3120B] text-white font-ui text-[13px] font-semibold px-4 h-9 hover:bg-[#B30E08] disabled:opacity-60">Sign up</button>
      </div>
      {msg && <p role="status" className={`mt-2 font-ui text-[12px] ${state === "error" ? "text-[#E3120B]" : "text-[#5B5B5B]"}`}>{msg}</p>}
      {token && <p className="mt-1 font-ui text-[12px]"><Link to={`/newsletter/preferences?token=${token}`} className="underline text-[#E3120B]">Manage your preferences</Link> (bookmark this link).</p>}
    </form>
  );
};
