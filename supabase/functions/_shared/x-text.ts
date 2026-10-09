// X (Twitter) weighted length, v3 rules. Implemented locally (no npm:twitter-text)
// so it runs identically in Deno and in tests. Must match src/lib/xText.ts.
// Each URL = 23; code points in 0-4351, 8192-8205, 8208-8223, 8242-8247 count 1;
// everything else (CJK, emoji, ...) counts 2.

export const X_URL_RE = /https?:\/\/[^\s]+/g;
export const X_URL_WEIGHT = 23;

function cpWeight(cp: number): number {
  if (cp <= 4351) return 1;
  if (cp >= 8192 && cp <= 8205) return 1;
  if (cp >= 8208 && cp <= 8223) return 1;
  if (cp >= 8242 && cp <= 8247) return 1;
  return 2;
}

export function weightedLength(text: string): number {
  const s = (text || "").normalize("NFC");
  let total = 0;
  let last = 0;
  for (const m of s.matchAll(X_URL_RE)) {
    const idx = m.index ?? 0;
    for (const ch of s.slice(last, idx)) total += cpWeight(ch.codePointAt(0)!);
    total += X_URL_WEIGHT;
    last = idx + m[0].length;
  }
  for (const ch of s.slice(last)) total += cpWeight(ch.codePointAt(0)!);
  return total;
}
