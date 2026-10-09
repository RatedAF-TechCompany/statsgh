// Code-side house checks for statsgh-x-autopost. Never trusts the model's own checks.
import { weightedLength, X_URL_RE } from "./x-text.ts";
import { crimeTextHit } from "./crime-gate.ts";

export interface CheckResult { pass: boolean; detail: string }
export interface HouseCheckInput {
  post: string;
  article: { title?: string | null; summary?: string | null; body?: string | null };
  url: string;
  modelJson: any;
  recentTopicKeys?: string[]; // topic_keys posted in the last 24h
}
export interface HouseCheckOutput { pass: boolean; checks: Record<string, CheckResult>; warnings: string[] }

const ALLOWED_CAPS = new Set([
  "GSS", "BoG", "IMF", "ECG", "GRA", "MoF", "GDP", "CPI", "PURC", "COCOBOD", "MPC", "GSE", "SSNIT",
  "NHIS", "VRA", "GRIDCO", "ECOWAS", "GNPC", "NPA", "OPEC", "USD", "GHS",
]);

const MULT: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, bn: 1e9, billion: 1e9, tn: 1e12, trillion: 1e12,
};
const NUM_RE = /(\d[\d,]*(?:\.\d+)?)(?:\s*(k|thousand|mn|m|million|bn|billion|tn|trillion)\b)?/gi;

interface Num { raw: string; mantissa: number; mult: number; decimals: number; value: number }

export function extractNumbers(text: string): Num[] {
  const out: Num[] = [];
  for (const m of (text || "").matchAll(NUM_RE)) {
    const digits = m[1].replace(/,/g, "");
    const mantissa = Number(digits);
    if (!isFinite(mantissa)) continue;
    const mult = m[2] ? MULT[m[2].toLowerCase()] ?? 1 : 1;
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    out.push({ raw: m[0], mantissa, mult, decimals, value: mantissa * mult });
  }
  return out;
}

const stripHtml = (s: string) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9;

export function numberInArticle(n: Num, articleNums: Num[]): boolean {
  for (const a of articleNums) {
    if (near(a.value, n.value)) return true;
    // Rounded to the post's precision, on the post's own scale (e.g. 1.23bn -> 1.2bn).
    const scaled = a.value / n.mult;
    const f = Math.pow(10, n.decimals);
    if (near(Math.round(scaled * f) / f, n.mantissa)) return true;
  }
  return false;
}

const urlsIn = (s: string) => [...(s || "").matchAll(X_URL_RE)].map((m) => m[0].replace(/[).,;:]+$/, ""));
const noUrl = (s: string) => (s || "").replace(X_URL_RE, " ");

export function runHouseChecks(input: HouseCheckInput): HouseCheckOutput {
  const { post = "", article, url, modelJson } = input;
  const checks: Record<string, CheckResult> = {};
  const warnings: string[] = [];
  const set = (k: string, pass: boolean, detail = "") => (checks[k] = { pass, detail });
  const mj = modelJson || {};
  const articleText = `${article.title ?? ""} ${article.summary ?? ""} ${stripHtml(article.body ?? "")}`;
  const text = noUrl(post);

  set("json_ok", mj.status === "OK" && !!String(post).trim() && !!String(mj.topic_key ?? "").trim() && !!String(mj.format ?? "").trim(),
    `status=${mj.status ?? "?"}`);

  const urls = urlsIn(post);
  set("one_url", urls.length === 1 && urls[0] === url, `found ${urls.length}: ${urls.join(" ")}`);

  const wl = weightedLength(post);
  set("length_ok", wl <= 280, `weighted ${wl}`);
  set("no_newline", !/[\r\n]/.test(post), "");

  // Key number within first 40 characters.
  const keyRaw = String(mj.key_number ?? "").trim();
  const keyTok = (keyRaw.match(/\d[\d,]*(?:\.\d+)?/) || [])[0] || (text.match(/\d[\d,]*(?:\.\d+)?/) || [])[0] || "";
  const head = post.slice(0, 40).replace(/,/g, "");
  const keyNorm = keyTok.replace(/,/g, "");
  set("key_number_in_40", !!keyNorm && head.includes(keyNorm), `key "${keyTok}"`);

  // STRICT: every number in the post must be in the article.
  const artNums = extractNumbers(articleText);
  const missing = extractNumbers(text).filter((n) => !numberInArticle(n, artNums)).map((n) => n.raw.trim());
  set("numbers_in_article", missing.length === 0, missing.length ? `not in article: ${missing.join(", ")}` : "");

  // Banned patterns.
  const bans: string[] = [];
  if (/\p{Extended_Pictographic}/u.test(post)) bans.push("emoji");
  if (text.includes("!")) bans.push("exclamation");
  const hashtags = (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
  if (hashtags > 1) bans.push("more than one hashtag");
  if (/(^|\s)@\w+/.test(text)) bans.push("@mention");
  if (/GH¢|₵|\bGHC\b/i.test(text)) bans.push("GH¢/₵/GHC");
  if (/\b(BREAKING|SHOCKING)\b/i.test(text)) bans.push("BREAKING/SHOCKING");
  const caps = (text.match(/\b[A-Za-z]{5,}\b/g) || []).filter((w) => w === w.toUpperCase() && !ALLOWED_CAPS.has(w));
  if (caps.length) bans.push(`all caps: ${caps.join(",")}`);
  if (/^\s*according to\b/i.test(text)) bans.push("opens with According to");
  const firstSentence = text.split(/(?<=[.?])\s/)[0] || "";
  if (/\b(reports|says|said) that\b/i.test(firstSentence)) bans.push("'X reports/says that' opening");
  if (/\bthread\b|🧵|you won'?t believe|here'?s why/i.test(text)) bans.push("teaser");
  if (/\b(massive|significant|skyrocket\w*)\b|\bmany ghanaians\b/i.test(text)) bans.push("vague hype word");
  for (const ph of ["record", "highest ever", "first time"]) {
    const re = new RegExp(`\\b${ph}\\b`, "i");
    if (re.test(text) && !re.test(articleText)) bans.push(`'${ph}' not in article`);
  }
  const qIdx = text.lastIndexOf("?");
  if (qIdx >= 0 && text.slice(qIdx + 1).trim().length < 10) bans.push("unanswered question");
  set("banned_patterns", bans.length === 0, bans.join("; "));

  set("not_crime", !crimeTextHit(text), "");

  const tk = String(mj.topic_key ?? "").trim().toLowerCase();
  const recent = (input.recentTopicKeys || []).map((k) => String(k).trim().toLowerCase());
  set("not_duplicate_topic", !tk || !recent.includes(tk), tk);

  const before = post.split(url)[0]?.trim() ?? "";
  const bl = [...before].length;
  if (bl < 120 || bl > 230) warnings.push(`text before URL is ${bl} chars (house range 120-230)`);

  return { pass: Object.values(checks).every((c) => c.pass), checks, warnings };
}

export const failedChecks = (checks: Record<string, CheckResult>) =>
  Object.entries(checks).filter(([, c]) => !c.pass).map(([k]) => k);
