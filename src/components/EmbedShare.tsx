import { useState } from "react";
import { toast } from "sonner";

/** "Embed / share" control for a public chart at /embed/<series>. */
export const EmbedShare = ({ series, title }: { series: string; title: string }) => {
  const [open, setOpen] = useState(false);
  const url = `https://statsgh.com/embed/${series}`;
  const code = `<iframe src="${url}" title="${title.replace(/"/g, "")} — StatsGH" width="100%" height="360" style="border:1px solid #D9D9D9" loading="lazy"></iframe>`;
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Could not copy"); }
  };
  const page = "https://statsgh.com/trackers/fuel-and-cedi";
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="font-ui text-xs font-semibold text-[#E3120B] underline" aria-expanded={open}>
        {open ? "Hide embed & share" : "Embed / share this chart"}
      </button>
      {open && (
        <div className="mt-2 border border-[#D9D9D9] bg-[#FAF7F2] p-3 space-y-2">
          <textarea readOnly value={code} className="w-full font-mono text-[11px] p-2 border border-[#D9D9D9] bg-white h-16" aria-label="Embed code" />
          <div className="flex flex-wrap gap-3 font-ui text-xs">
            <button className="underline" onClick={() => copy(code, "Embed code")}>Copy embed code</button>
            <button className="underline" onClick={() => copy(url, "Link")}>Copy chart link</button>
            <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/tweet?text=${encodeURIComponent(`${title} — via @StatsGH`)}&url=${encodeURIComponent(page)}`}>Share on X</a>
            <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} — StatsGH ${page}`)}`}>Share on WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
};
