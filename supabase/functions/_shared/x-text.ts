// X (Twitter) weighted length, v3 rules. Implemented locally (no npm:twitter-text)
// so it runs identically in Deno and in tests. Must match src/lib/xText.ts.
// Each URL = 23; each emoji sequence = 2; code points in 0-4351, 8192-8205,
// 8208-8223, 8242-8247 count 1; everything else counts 2.

export const X_URL_RE = /https?:\/\/[^\s]+/g;
export const X_URL_WEIGHT = 23;
// One emoji "sequence" = weight 2 (twitter-text v3): flag pairs, keycaps, pictographs with
// VS16 / skin tones, and ZWJ sequences. A lone regional indicator also counts 2.
export const EMOJI_SEQ_RE =
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
    total += plainWeight(s.slice(last, idx)) + X_URL_WEIGHT;
    last = idx + m[0].length;
  }
  return total + plainWeight(s.slice(last));
}
