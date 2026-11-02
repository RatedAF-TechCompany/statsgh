"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

// Cloudflare Turnstile (free) site key for statsgh.com / www.statsgh.com. Public by design; the secret lives only in the Worker.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFw7AE_18rWm2MXM";

export type FormKind = "contact" | "advertise" | "sponsored" | "fellowship" | "api" | "whatsapp" | "factcheck";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(254),
  organisation: z.string().trim().max(150).optional(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(1, "Please enter a message").max(3000),
});

const COPY: Record<FormKind, { org?: string; subject?: string; message: string; label: string; done: string; button?: string }> = {
  contact: { subject: "Subject", message: "Your message", label: "Contact form", done: "Thank you. Your message has reached the StatsGH team." },
  advertise: { org: "Company or organisation", message: "Tell us what you'd like to promote, your budget and timing", label: "Advertising enquiry", done: "Thank you. We will reply about advertising options." },
  sponsored: { org: "Company or organisation", subject: "Report topic", message: "What should the data report cover, who is it for, and your timing?", label: "Sponsored data report enquiry", done: "Thank you. We will reply about a sponsored report." },
  fellowship: { org: "University and course", subject: "Year of study", message: "Why you want to join, and any data or writing work we can look at (links welcome)", label: "Data fellowship application", done: "Thank you. Your application has reached the StatsGH team.", button: "Apply" },
  api: { org: "Company or organisation", subject: "Datasets you need", message: "How you plan to use the data and roughly how many requests a day", label: "API access request", done: "Thank you. We will reply about API access.", button: "Request access" },
  whatsapp: { message: "Which topics do you want alerts on? (cedi, inflation, GSE, budget...)", label: "WhatsApp alerts sign-up", done: "Thank you. We will tell you when the StatsGH WhatsApp channel opens.", button: "Notify me" },
  factcheck: { subject: "Who made the claim, and where", message: "The claim, word for word, and a link if you have one", label: "Submit a claim to check", done: "Thank you. An editor will look at the claim.", button: "Submit claim" },
};

const input = "w-full border border-[#D9D9D9] px-3 h-10 font-ui text-[14px]";

declare global { interface Window { turnstile?: any } }

export const ContactForm = ({ kind = "contact" }: { kind?: FormKind }) => {
  const c = COPY[kind];
  const [f, setF] = useState({ name: "", email: "", organisation: "", subject: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [err, setErr] = useState("");
  const [token, setToken] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const wid = useRef<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !box.current || !window.turnstile || wid.current) return;
      wid.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY, callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""), "error-callback": () => setToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      const id = "cf-turnstile-script";
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement("script");
        s.id = id; s.async = true; s.defer = true;
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        document.head.appendChild(s);
      }
      s.addEventListener("load", render);
    }
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(f);
    if (!p.success) { setErr(p.error.issues[0].message); return; }
    if (!token) { setErr("Please complete the security check."); return; }
    setErr(""); setState("saving");
    try {
      const r = await fetch("/__forms/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...p.data, website: f.website, token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "Could not send your message. Please email Officeofnajib@gmail.com instead.");
      setState("done");
    } catch (x: any) {
      setState("idle"); setErr(x.message);
      setToken(""); if (wid.current && window.turnstile) window.turnstile.reset(wid.current);
    }
  };

  if (state === "done") return <p className="font-serif text-[17px] border-l-4 border-[#E3120B] pl-3 py-2">{c.done}</p>;

  return (
    <form onSubmit={submit} className="space-y-3 max-w-[560px]" aria-label={c.label}>
      <div className="grid md:grid-cols-2 gap-3">
        <input className={input} placeholder="Your name" value={f.name} onChange={set("name")} maxLength={100} aria-label="Name" required />
        <input className={input} type="email" placeholder="Email address" value={f.email} onChange={set("email")} maxLength={254} aria-label="Email" required />
      </div>
      {c.org && <input className={input} placeholder={c.org} value={f.organisation} onChange={set("organisation")} maxLength={150} aria-label={c.org} />}
      {c.subject && <input className={input} placeholder={c.subject} value={f.subject} onChange={set("subject")} maxLength={150} aria-label={c.subject} />}
      <textarea className="w-full border border-[#D9D9D9] px-3 py-2 font-ui text-[14px] min-h-[140px]" placeholder={c.message} value={f.message} onChange={set("message")} maxLength={3000} aria-label="Message" required />
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div ref={box} />
      {err && <p className="font-ui text-[13px] text-[#B30E08]">{err}</p>}
      <button type="submit" disabled={state === "saving"} className="bg-[#E3120B] text-white font-ui text-[14px] font-semibold px-5 h-10 hover:bg-[#B30E08] disabled:opacity-60">
        {state === "saving" ? "Sending…" : c.button || "Send"}
      </button>
    </form>
  );
};
