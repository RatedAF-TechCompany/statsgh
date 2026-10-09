// X (Twitter) weighted length, v3 rules. Must stay identical to
// supabase/functions/_shared/x-text.ts (used by the autopost house checks).
const X_URL_RE = /https?:\/\/[^\s]+/g;
const EMOJI_SEQ_RE =
  /[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*)*|[\u{1F1E6}-\u{1F1FF}]/gu;

function cpWeight(cp: number): number {
  if (cp <= 4351) return 1;
  if (cp >= 8192 && cp <= 8205) return 1;
  if (cp >= 8208 && cp <= 8223) return 1;
  if (cp >= 8242 && cp <= 8247) return 1;
  return 2;
}

function plainWeight(seg: string): number {
  let t = 0, last = 0;
  for (const m of seg.matchAll(EMOJI_SEQ_RE)) {
    const idx = m.index ?? 0;
    for (const ch of seg.slice(last, idx)) t += cpWeight(ch.codePointAt(0)!);
    t += 2;
    last = idx + m[0].length;
  }
  for (const ch of seg.slice(last)) t += cpWeight(ch.codePointAt(0)!);
  return t;
}

export function weightedLength(text: string): number {
  const s = (text || "").normalize("NFC");
  let total = 0, last = 0;
  for (const m of s.matchAll(X_URL_RE)) {
    const idx = m.index ?? 0;
    total += plainWeight(s.slice(last, idx)) + 23;
    last = idx + m[0].length;
  }
  return total + plainWeight(s.slice(last));
}
