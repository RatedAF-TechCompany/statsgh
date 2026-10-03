import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const NewsletterSignup = ({ source = "footer" }: { source?: string }) => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setState("error"); setMsg("Please enter a valid email address."); return;
    }
    setState("saving");
    const { error } = await (supabase as any).from("newsletter_subscribers").insert({ email: value, source });
    if (error && error.code !== "23505") {
      setState("error"); setMsg("Could not sign you up. Please try again."); return;
    }
    setState("done"); setMsg("You're on the list for the daily StatsGH digest.");
    setEmail("");
  };

  return (
    <form onSubmit={submit} className="mt-6" aria-label="Daily email digest signup">
      <h3 className="kicker mb-2">Daily digest</h3>
      <p className="font-ui text-[13px] text-[#5B5B5B] mb-2">Ghana's key numbers, once a day.</p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 min-w-0 border border-[#D9D9D9] px-3 h-9 font-ui text-[13px]"
        />
        <button type="submit" disabled={state === "saving"} className="bg-[#E3120B] text-white font-ui text-[13px] font-semibold px-4 h-9 hover:bg-[#B30E08] disabled:opacity-60">
          Sign up
        </button>
      </div>
      {msg && <p role="status" className={`mt-2 font-ui text-[12px] ${state === "error" ? "text-[#E3120B]" : "text-[#5B5B5B]"}`}>{msg}</p>}
    </form>
  );
};
