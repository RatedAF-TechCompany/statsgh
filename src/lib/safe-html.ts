/**
 * Defence-in-depth for article HTML rendered with dangerouslySetInnerHTML.
 * Article bodies come from the newsroom pipeline (partly machine-written from scraped sources),
 * so strip anything executable before it reaches the page. Works on server and client (no DOM needed).
 */
const DROP_BLOCK = /<(script|style|iframe|object|embed|noscript|template|form|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const DROP_TAG = /<\/?(script|style|iframe|object|embed|noscript|template|form|input|button|textarea|select|link|meta|base|svg|math|frame|frameset)\b[^>]*>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /(\s(?:href|src|xlink:href|action|formaction)\s*=\s*)("\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*'|(?:javascript|vbscript):[^\s>]*)/gi;
const SRCDOC = /\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function sanitizeArticleHtml(html: string): string {
  if (!html) return "";
  return String(html)
    .replace(DROP_BLOCK, "")
    .replace(DROP_TAG, "")
    .replace(EVENT_ATTR, "")
    .replace(SRCDOC, "")
    .replace(JS_URL, '$1"#"');
}

const NUMBER = /\b(\d+(?:[.,]\d+)*(?:\s*%|°C|°F|km|m|kg|g|bn|mn|tn|\$|£|€|¢|GH₵)?)\b/g;

/** Wrap figures in text only — never inside tags or attribute values (that used to break links like /2026/...). */
export function highlightNumbersInHtml(html: string): string {
  return html
    .split(/(<[^>]*>)/g)
    .map((part) => (part.startsWith("<") ? part : part.replace(NUMBER, '<span class="number-highlight">$1</span>')))
    .join("");
}
