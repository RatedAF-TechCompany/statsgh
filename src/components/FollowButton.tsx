"use client";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Lets a reader follow a topic, company or indicator by email. Alerts are not sent yet. */
export const FollowButton = ({ type, targetKey, label }: { type: "topic" | "company" | "indicator"; targetKey: string; label: string }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await (supabase as any).rpc("follow_target", { p_email: email, p_type: type, p_key: targetKey, p_label: label });
    setMsg(error ? "Please enter a valid email address." : `Following ${label}. Alerts are not switched on yet; we will email you before the first one.`);
    if (!error) setEmail("");
  };
  if (!open) return <button onClick={() => setOpen(true)} className="font-ui text-[12px] font-semibold border border-[#121212] px-3 h-8 hover:bg-[#121212] hover:text-white">+ Follow {label}</button>;
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-center" aria-label={`Follow ${label}`}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" className="border border-[#D9D9D9] px-2 h-8 font-ui text-[12px]" />
      <button type="submit" className="bg-[#121212] text-white font-ui text-[12px] font-semibold px-3 h-8">Follow</button>
      {msg && <p role="status" className="w-full font-ui text-[12px] text-[#5B5B5B]">{msg}</p>}
    </form>
  );
};
