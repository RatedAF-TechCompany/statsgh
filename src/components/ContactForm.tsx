"use client";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(254),
  organisation: z.string().trim().max(150).optional(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(1, "Please enter a message").max(3000),
});

const input = "w-full border border-[#D9D9D9] px-3 h-10 font-ui text-[14px]";

export const ContactForm = ({ kind = "contact" }: { kind?: "contact" | "advertise" }) => {
  const [f, setF] = useState({ name: "", email: "", organisation: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(f);
    if (!p.success) { setErr(p.error.issues[0].message); return; }
    setErr(""); setState("saving");
    const d = p.data;
    const { error } = await (supabase as any).from("contact_messages").insert({
      kind, name: d.name, email: d.email.toLowerCase(), organisation: d.organisation || null, subject: d.subject || null, message: d.message,
    });
    if (error) { setState("idle"); setErr("Could not send your message. Please email officeofstatsgh@gmail.com instead."); return; }
    setState("done");
  };

  if (state === "done") return <p className="font-serif text-[17px] border-l-4 border-[#E3120B] pl-3 py-2">Thank you. Your message has reached the StatsGH team.</p>;

  return (
    <form onSubmit={submit} className="space-y-3 max-w-[560px]" aria-label={kind === "advertise" ? "Advertising enquiry" : "Contact form"}>
      <div className="grid md:grid-cols-2 gap-3">
        <input className={input} placeholder="Your name" value={f.name} onChange={set("name")} maxLength={100} aria-label="Name" required />
        <input className={input} type="email" placeholder="Email address" value={f.email} onChange={set("email")} maxLength={254} aria-label="Email" required />
      </div>
      {kind === "advertise"
        ? <input className={input} placeholder="Company or organisation" value={f.organisation} onChange={set("organisation")} maxLength={150} aria-label="Organisation" />
        : <input className={input} placeholder="Subject" value={f.subject} onChange={set("subject")} maxLength={150} aria-label="Subject" />}
      <textarea className="w-full border border-[#D9D9D9] px-3 py-2 font-ui text-[14px] min-h-[140px]" placeholder={kind === "advertise" ? "Tell us what you'd like to promote, your budget and timing" : "Your message"} value={f.message} onChange={set("message")} maxLength={3000} aria-label="Message" required />
      {err && <p className="font-ui text-[13px] text-[#B30E08]">{err}</p>}
      <button type="submit" disabled={state === "saving"} className="bg-[#E3120B] text-white font-ui text-[14px] font-semibold px-5 h-10 hover:bg-[#B30E08] disabled:opacity-60">
        {state === "saving" ? "Sending…" : "Send"}
      </button>
    </form>
  );
};
