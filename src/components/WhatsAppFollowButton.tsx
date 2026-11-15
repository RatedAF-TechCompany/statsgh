import { WHATSAPP_CHANNEL_URL } from "@/lib/social";

/** "Follow on WhatsApp" link to the StatsGH WhatsApp Channel. Renders nothing until the channel URL is set. */
export function WhatsAppFollowButton({ className = "" }: { className?: string }) {
  if (!WHATSAPP_CHANNEL_URL) return null;
  return (
    <a
      href={WHATSAPP_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 bg-[#128C4A] text-white font-ui text-[13px] font-semibold px-3 py-1.5 rounded hover:bg-[#0E703B] ${className}`}
    >
      Follow StatsGH on WhatsApp
    </a>
  );
}
