// Calabashe house ad. 728x90 on desktop (md+), 320x100 on mobile. Height reserved via width/height attrs + aspect-ratio.
const HREF = "https://calabashe.com/write-review";
const ALT = "Calabashe: Seen a doctor lately? Tell Ghana how it went. Leave a review";
export const HOUSE_AD_HTML =
  `<aside class="house-ad not-prose my-8 flex justify-center" aria-label="Advertisement" data-house-ad="calabashe">` +
  `<a href="${HREF}" target="_blank" rel="sponsored noopener" class="block md:hidden w-full max-w-[320px]"><img src="/ads/calabashe-320x100.png" width="320" height="100" loading="lazy" decoding="async" alt="${ALT}" style="display:block;width:100%;height:auto;aspect-ratio:320/100;margin:0"></a>` +
  `<a href="${HREF}" target="_blank" rel="sponsored noopener" class="hidden md:block w-full max-w-[728px]"><img src="/ads/calabashe-728x90.png" width="728" height="90" loading="lazy" decoding="async" alt="${ALT}" style="display:block;width:100%;height:auto;aspect-ratio:728/90;margin:0"></a>` +
  `</aside>`;
/** Insert the ad after the 3rd closing </p> of article HTML; body text is untouched. */
export function withHouseAd(html: string): string {
  if (!html) return html;
  let idx = -1;
  for (let n = 0; n < 3; n++) { idx = html.indexOf("</p>", idx + 1); if (idx < 0) return html + HOUSE_AD_HTML; }
  const at = idx + 4;
  return html.slice(0, at) + HOUSE_AD_HTML + html.slice(at);
}
