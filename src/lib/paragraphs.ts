// Deterministic news paragraphing. Shared verbatim by the site renderer
// (src/lib/paragraphs.ts) and the publishing edge functions.
// Turns plain text, markdown, literal "\n" sequences or <p> HTML into short
// <p> paragraphs: lead first, then 2–3 sentences each. Never changes wording.

const ABBR = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "rev", "hon", "gen", "col", "lt", "capt", "sgt", "gov", "sen", "rep",
  "co", "corp", "inc", "ltd", "plc", "no", "nos", "vs", "etc", "e.g", "i.e", "approx", "est", "dept", "govt", "jan", "feb",
  "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "h.e", "u.s", "u.k", "a.m", "p.m", "fig", "op",
]);

const MAX_SENTENCES = 3;
const MAX_CHARS = 420;

const BLOCK_RE = /<(p|h[1-6]|ul|ol|blockquote|figure|table|pre|div|hr)\b/i;

export function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out: string[] = [];
  const re = /[.!?]+["'”’)\]]*(?=\s+["'“‘(\[]?[A-Z0-9])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const end = m.index + m[0].length;
    const before = t.slice(start, m.index);
    const word = (before.match(/(\S+)$/)?.[1] || "").replace(/^["'“‘(]+/, "").toLowerCase();
    // Skip abbreviations, initials (H.E., J.), and decimals.
    if (m[0][0] === "." && (ABBR.has(word) || /^([a-z]\.)*[a-z]$/i.test(word))) continue;
    out.push(t.slice(start, end).trim());
    start = end;
  }
  const rest = t.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

// Group sentences into paragraphs. The first group is the lead.
export function groupSentences(sentences: string[], isLead = false): string[] {
  const paras: string[] = [];
  let i = 0;
  if (isLead && sentences.length) {
    const take = sentences.length > 1 && sentences[0].length < 160 && sentences[0].length + sentences[1].length < 300 ? 2 : 1;
    paras.push(sentences.slice(0, take).join(" "));
    i = take;
  }
  let cur: string[] = [];
  let len = 0;
  for (; i < sentences.length; i++) {
    const s = sentences[i];
    if (cur.length && (cur.length >= MAX_SENTENCES || (cur.length >= 2 && len + s.length > MAX_CHARS) || (cur.length >= 1 && len + s.length > MAX_CHARS * 1.3))) {
      paras.push(cur.join(" "));
      cur = []; len = 0;
    }
    cur.push(s); len += s.length + 1;
  }
  if (cur.length) {
    // Avoid an orphan one-sentence tail when the previous paragraph has 3.
    const prev = paras.length ? splitSentences(paras[paras.length - 1]) : [];
    if (cur.length === 1 && prev.length === 3 && !(isLead && paras.length === 1)) {
      paras[paras.length - 1] = prev.slice(0, 2).join(" ");
      paras.push([prev[2], cur[0]].join(" "));
    } else paras.push(cur.join(" "));
  }
  return paras;
}

function esc(s: string) {
  return s.replace(/&(?![a-z0-9#]+;)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
}

function paragraphsFromText(blocks: string[], leadDone: { v: boolean }): string[] {
  const html: string[] = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const h = lines.length === 1 && lines[0].match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (h) { const lvl = Math.min(Math.max(h[1].length, 2), 4); html.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`); continue; }
    if (lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l))) {
      const tag = /^\d/.test(lines[0]) ? "ol" : "ul";
      html.push(`<${tag}>${lines.map((l) => `<li>${inlineMd(l.replace(/^([-*•]|\d+[.)])\s+/, ""))}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (lines.every((l) => l.startsWith(">"))) {
      html.push(`<blockquote><p>${inlineMd(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}</p></blockquote>`);
      continue;
    }
    // Sentence-per-line or hard-wrapped text: join lines, then regroup.
    const sentences = splitSentences(lines.join(" "));
    for (const p of groupSentences(sentences, !leadDone.v)) html.push(`<p>${inlineMd(p)}</p>`);
    leadDone.v = true;
  }
  return html;
}

function paragraphsFromHtml(src: string): string[] {
  const out: string[] = [];
  const leadDone = { v: false };
  const re = /<(p|h[1-6]|ul|ol|blockquote|figure|table|pre|div)\b([^>]*)>([\s\S]*?)<\/\1>|<hr\b[^>]*\/?>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  const loose = (s: string) => {
    const t = s.trim();
    if (t) out.push(...paragraphsFromText(t.split(/\n{2,}/), leadDone));
  };
  while ((m = re.exec(src))) {
    loose(src.slice(last, m.index));
    last = m.index + m[0].length;
    const tag = (m[1] || "").toLowerCase();
    if (tag === "p" && !/class=/.test(m[2] || "")) {
      const inner = m[3].trim();
      if (!inner) continue;
      // Split overlong <p> at sentence boundaries; keep inline HTML intact
      // (we only split where no tag is open across the boundary).
      const parts = inner.split(/<br\s*\/?>\s*(?:<br\s*\/?>)+|\n{2,}/i);
      for (const part of parts) {
        const plain = part.replace(/\s+/g, " ").trim();
        if (!plain) continue;
        const sents = splitSentences(plain);
        const balanced = sents.every((s) => (s.match(/<[a-z]/gi) || []).length === (s.match(/<\//g) || []).length);
        const groups = balanced ? groupSentences(sents, !leadDone.v) : [plain];
        for (const g of groups) out.push(`<p>${g}</p>`);
        leadDone.v = true;
      }
    } else {
      out.push(m[0]);
    }
  }
  loose(src.slice(last));
  return out;
}

export function formatArticleBody(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input)
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n|\\n/g, "\n") // literal backslash-n sequences
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (BLOCK_RE.test(s)) return paragraphsFromHtml(s).join("\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  return paragraphsFromText(s.split(/\n{2,}/), { v: false }).join("\n");
}

// Plain-text words, for checking that reformatting changed no wording.
export function wordsOf(html: string): string {
  return html.replace(/\\n/g, " ").replace(/<[^>]+>/g, " ").replace(/[*_#>]|^\s*[-•]\s/gm, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
