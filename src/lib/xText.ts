// X (Twitter) weighted length, v3 rules. Must stay identical to
// supabase/functions/_shared/x-text.ts (used by the autopost house checks).
const X_URL_RE = /https?:\/\/[^\s]+/g;

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
    total += 23;
    last = idx + m[0].length;
  }
  for (const ch of s.slice(last)) total += cpWeight(ch.codePointAt(0)!);
  return total;
}
