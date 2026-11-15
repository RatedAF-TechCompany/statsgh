import { GOOGLE_PREFERRED_SOURCE_URL, X_HANDLE } from "@/lib/social";
import { WhatsAppFollowButton } from "@/components/WhatsAppFollowButton";

/**
 * Plain links (no JavaScript, server-rendered): WhatsApp share, X share, and Google's
 * "Add as preferred source" deeplink. WhatsApp shares a one-line headline plus the URL.
 */
export function ArticleShareRow({ title, url }: { title: string; url: string }) {
  const enc = encodeURIComponent;
  const linkCls = "underline text-[#E3120B] hover:text-[#121212]";
  return (
    <div className="font-ui text-[13px] flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#D9D9D9] pt-4 mb-8" aria-label="Share and follow">
      <span className="text-[#5B5B5B]">Share:</span>
      <a className={linkCls} href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer" data-share="whatsapp">WhatsApp</a>
      <a className={linkCls} href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}&via=${enc(X_HANDLE.replace("@", ""))}`} target="_blank" rel="noopener noreferrer">X</a>
      <a className={linkCls} href={`mailto:?subject=${enc(title)}&body=${enc(url)}`}>Email</a>
      <a className={linkCls} href={GOOGLE_PREFERRED_SOURCE_URL} target="_blank" rel="noopener noreferrer">Add StatsGH as a preferred source on Google</a>
      <WhatsAppFollowButton />
    </div>
  );
}
