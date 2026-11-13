import { formatArticleBody } from "../paragraphs";
import { sanitizeArticleHtml } from "../safe-html";
import { isLiveDate, isLiveSlug } from "./paths";

export class LiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveValidationError";
  }
}

const COLON = /[:：]/;
const HTTPS = /^https:\/\/[^\s]+$/i;

export function assertNoColon(label: string, value: string): void {
  if (COLON.test(value)) {
    throw new LiveValidationError(`${label} must not contain a colon`);
  }
}

export function assertHeadline(headline: string): string {
  const h = String(headline || "").replace(/\s+/g, " ").trim();
  if (h.length < 8 || h.length > 140) throw new LiveValidationError("Headline must be 8–140 characters");
  assertNoColon("Headline", h);
  return h;
}

export function assertByline(byline: string): string {
  const b = String(byline || "").replace(/\s+/g, " ").trim();
  if (b.length < 2 || b.length > 80) throw new LiveValidationError("Byline must be 2–80 characters");
  return b;
}

export function assertSlug(slug: string): string {
  const s = String(slug || "").trim().toLowerCase();
  if (!isLiveSlug(s)) throw new LiveValidationError("Slug must be lowercase letters, numbers and hyphens, without a trailing date");
  if (s.length > 80) throw new LiveValidationError("Slug is too long");
  return s;
}

export function assertDate(date: string): string {
  if (!isLiveDate(date)) throw new LiveValidationError("Date must be a real YYYY-MM-DD");
  return date;
}

export function assertBullets(bullets: string[]): string[] {
  const list = (bullets || []).map((b) => String(b || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (list.length < 3 || list.length > 5) throw new LiveValidationError("Summary must have 3–5 bullets");
  for (const b of list) {
    if (b.length > 220) throw new LiveValidationError("Each summary bullet must be at most 220 characters");
  }
  return list;
}

export function assertEntryTitle(title: string): string {
  const t = String(title || "").replace(/\s+/g, " ").trim();
  if (t.length < 3 || t.length > 120) throw new LiveValidationError("Entry title must be 3–120 characters");
  assertNoColon("Entry title", t);
  return t;
}

/** Accept plain text or light HTML; return sanitised HTML of 1–4 short paragraphs. */
export function assertEntryBody(body: string): string {
  const raw = String(body || "").trim();
  if (!raw) throw new LiveValidationError("Entry body is required");
  const html = sanitizeArticleHtml(formatArticleBody(raw));
  const paras = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)];
  if (paras.length < 1 || paras.length > 4) {
    throw new LiveValidationError("Entry body must be 1–4 short paragraphs");
  }
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 8) throw new LiveValidationError("Entry body is too short");
  if (text.length > 2500) throw new LiveValidationError("Entry body is too long (keep it to 1–4 short paragraphs)");
  return html;
}

export function assertHttpsUrl(label: string, url: string | null | undefined): string | null {
  if (url == null || String(url).trim() === "") return null;
  const u = String(url).trim();
  if (!HTTPS.test(u)) throw new LiveValidationError(`${label} must be an https URL`);
  if (u.length > 2000) throw new LiveValidationError(`${label} is too long`);
  return u;
}

export function assertAlt(alt: string | null | undefined, hasImage: boolean): string | null {
  if (!hasImage) return null;
  const a = String(alt || "").replace(/\s+/g, " ").trim();
  if (!a) throw new LiveValidationError("Image alt text is required when an image is set");
  if (a.length > 200) throw new LiveValidationError("Image alt text is too long");
  return a;
}

export function assertCaption(caption: string | null | undefined): string | null {
  if (caption == null || String(caption).trim() === "") return null;
  return sanitizeArticleHtml(String(caption).replace(/\s+/g, " ").trim()).slice(0, 300);
}

export function parseBulletArg(raw: string): string[] {
  // "One | Two | Three" or newlines / ";;"
  const parts = String(raw || "").split(/\s*\|\s*|\n+|;;/g).map((s) => s.trim()).filter(Boolean);
  return assertBullets(parts);
}
