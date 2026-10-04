"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X_HANDLE } from "@/lib/social";

const safe = (u: unknown) => (typeof u === "string" && /^https:\/\//i.test(u.trim()) ? u.trim() : null);

/** Follow links. WhatsApp/Telegram render only when set in admin site settings. */
export const ChannelButtons = () => {
  const { data } = useQuery({
    queryKey: ["site-channels"], staleTime: 600_000,
    queryFn: async () => (await (supabase as any).from("site_settings").select("whatsapp_url, telegram_url, x_url").limit(1).maybeSingle()).data,
  });
  const x = safe(data?.x_url) || `https://x.com/${String(X_HANDLE).replace(/^@/, "")}`;
  const links = [
    { href: x, label: "Follow on X" },
    { href: safe(data?.whatsapp_url), label: "WhatsApp channel" },
    { href: safe(data?.telegram_url), label: "Telegram channel" },
  ].filter((l) => l.href);
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => <a key={l.label} href={l.href!} target="_blank" rel="noopener noreferrer" className="font-ui text-[12px] font-semibold border border-current px-3 h-8 inline-flex items-center hover:opacity-80">{l.label}</a>)}
    </div>
  );
};
