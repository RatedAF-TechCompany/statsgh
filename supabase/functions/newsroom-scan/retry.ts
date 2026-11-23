export const BACKLOG_LIMIT = 3;
export const BACKLOG_HOURS = 12;
export const MAX_ATTEMPTS = 3;
export const DEFAULT_MAX_ARTICLES_PER_RUN = 3;
export const RUN_WALL_CLOCK_MS = 80_000;
export const INTERRUPTED_RUN_ERROR = "Run did not complete (likely edge function timeout)";

export const DISCOVERY_MIN_SLOTS = 8;
export const FRESHNESS_MAX_AGE_MINUTES = 480; // (c) 8h, was 6h: 344 REJECTED_STALE in 72h
export const WATCHDOG_FRESHNESS_MAX_AGE_MINUTES = 720; // (a) catch-up run when the site is stale
export const BACKLOG_FRESHNESS_MAX_AGE_MINUTES = 720;

// Candidate discovery has its own allowance; writing remains capped separately.
export function phaseCandidateLimit(backlogPhase: boolean, backlogCount: number, runLimit: number, attemptedBacklog: number) {
  return backlogPhase ? Math.min(backlogCount, runLimit)
    : Math.max(DISCOVERY_MIN_SLOTS, runLimit - attemptedBacklog);
}

export function inferTriggerType(body: { trigger_type?: string; triggerType?: string }, via: string) {
  return body.trigger_type || body.triggerType ||
    (["service_role", "cron_secret_env", "scheduler_token"].includes(via) ? "scheduled" : "manual");
}

export function parseFeedDate(input: string): Date | null {
  let value = input.trim().replace(/<!\[CDATA\[|\]\]>/g, "");
  if (!value) return null;
  value = value.replace(/\b(WAT|GMT|UTC|BST)\b/gi, zone =>
    /^(WAT|BST)$/i.test(zone) ? "+0100" : "+0000");
  if (/^\d{4}-\d{2}-\d{2}T/i.test(value)) {
    value = value.replace(/\s+([+-]\d{4})$/, "$1");
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) value += "Z";
  } else {
    value = value.replace(/\bZ$/i, "+0000");
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) value += "T00:00:00Z";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function runTimeExceeded(startedAt: number, now = Date.now()) {
  return now - startedAt > RUN_WALL_CLOCK_MS;
}

export function interruptedRunCutoff(now: number) {
  return new Date(now - 10 * 60 * 1000).toISOString();
}

export function failureState(attempts: number, message: string) {
  return {
    attempts,
    processing_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
    dead_letter: attempts >= MAX_ATTEMPTS,
    error_message: message.slice(0, 500),
  };
}

// Repair syntax only: never supply missing fields, complete truncated output,
// evaluate model text, or substitute source/RSS copy.
function repairJsonStrings(content: string): string {
  let output = "";
  let inString = false;
  let isKey = false;
  let previous = "";
  const containers: string[] = [];

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (!inString) {
      output += char;
      if (char === '"') {
        inString = true;
        isKey = containers.at(-1) === "{" && (previous === "{" || previous === ",");
      } else if (char === "{" || char === "[") {
        containers.push(char);
      } else if (char === "}" || char === "]") {
        containers.pop();
      }
      if (!/\s/.test(char)) previous = char;
      continue;
    }

    if (char === "\\") {
      // Preserve existing escapes (including escaped backslashes/quotes).
      output += char;
      if (i + 1 < content.length) output += content[++i];
    } else if (char === '"') {
      const rest = content.slice(i + 1).trimStart();
      const closes = isKey
        ? rest.startsWith(":")
        : rest.startsWith("}") || rest.startsWith("]") || rest === "" ||
          (rest.startsWith(",") && (containers.at(-1) === "[" || /^,\s*"(?:[^"\\]|\\.)*"\s*:/.test(rest)));
      if (closes) {
        output += char;
        inString = false;
        previous = char;
      } else {
        output += '\\"';
      }
    } else if (char.charCodeAt(0) < 32) {
      // JSON strings cannot contain literal newlines or other control characters.
      output += `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
    } else {
      output += char;
    }
  }
  return output;
}

export function parseArticleJson(content: string, parse: (content: string) => any = JSON.parse) {
  const unfenced = content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  const object = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
  try {
    return parse(object);
  } catch {
    return parse(repairJsonStrings(object));
  }
}

// Give all three writing attempts enough room for a complete article JSON.
// No RSS text is ever substituted for a failed generation.
export async function writeWithRetries(
  call: (maxTokens: number) => Promise<string>,
  parse: (content: string) => any,
  isHalt: (error: unknown) => boolean,
) {
  let lastError: unknown;
  for (const maxTokens of [6000, 6000, 6000]) {
    try {
      const content = await call(maxTokens);
      if (!content.trim()) throw new Error("AI returned empty content");
      const generated = parseArticleJson(content, parse);
      const missing = ["headline", "body_html", "slug"].filter(
        (key) => typeof generated?.[key] !== "string" || !generated[key].trim(),
      );
      if (missing.length) throw new Error(`AI output missing ${missing.join(", ")}`);
      return generated;
    } catch (error) {
      if (isHalt(error)) throw error;
      lastError = error;
    }
  }
  throw new Error(`AI generation failed after 3 calls: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
// Recovery runs (triggerType "recovery") may reach back 24h for re-queued items.
export const RECOVERY_FRESHNESS_MAX_AGE_MINUTES = 1440;
export const RECOVERY_BACKLOG_HOURS = 24;

export function backlogFreshnessLimit(triggerType: string) {
  return triggerType === "recovery" ? RECOVERY_FRESHNESS_MAX_AGE_MINUTES : BACKLOG_FRESHNESS_MAX_AGE_MINUTES;
}

export function backlogHours(triggerType: string) {
  return triggerType === "recovery" ? RECOVERY_BACKLOG_HOURS : BACKLOG_HOURS;
}

export const MIN_WORDS = 250; // publication gate; never lowered
export const TARGET_WORDS_MIN = 320;
export const TARGET_WORDS_MAX = 450;

export function countBodyWords(html: string): number {
  const text = (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).filter((w) => w.length > 0).length : 0;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// House rules that code can check: no source credits (links, "according to",
// "Source:" lines, the outlet's own name), no hashtags, no colon in headline.
export function houseRuleIssues(
  generated: { headline?: string; summary?: string; subtitle?: string; body_html?: string },
  sourceName = "",
): string[] {
  const issues: string[] = [];
  const headline = generated.headline || "";
  const text = [headline, generated.subtitle || "", generated.summary || "", generated.body_html || ""].join("\n");
  const plain = text.replace(/<[^>]+>/g, " ");
  if (headline.includes(":")) issues.push("colon in headline");
  if (/<a\b|https?:\/\/|\bwww\./i.test(text)) issues.push("link");
  if (/\baccording to\b/i.test(plain)) issues.push("'according to'");
  if (/(^|\s)#[A-Za-z][\w]*/.test(plain)) issues.push("hashtag");
  if (/\bsources?\s*:/i.test(plain)) issues.push("source credit line");
  const outlet = sourceName.replace(/\s*[—–-].*$/, "").trim();
  // Only check outlet-style names (not institutions such as Bank of Ghana).
  const institutional = /\b(bank of ghana|ministry|authority|commission|exchange|statistical service|revenue|sec ghana|government)\b/i;
  if (outlet.length >= 4 && !institutional.test(outlet) && new RegExp(`\\b${escapeRe(outlet)}\\b`, "i").test(plain)) {
    issues.push(`outlet name (${outlet})`);
  }
  return issues;
}

// Deterministic last-resort clean-up after the model has had its revise call.
export function applyHouseFixes<T extends { headline?: string; body_html?: string; summary?: string; subtitle?: string }>(g: T): T {
  const stripLinks = (s: string) => (s || "").replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  const stripTags = (s: string) => (s || "").replace(/(^|\s)#([A-Za-z][\w]*)/g, "$1$2");
  return {
    ...g,
    headline: (g.headline || "").replace(/\s*:\s*/g, " ").replace(/\s{2,}/g, " ").trim(),
    body_html: stripTags(stripLinks(g.body_html || "")),
    summary: stripTags(stripLinks(g.summary || "")),
    subtitle: stripTags(stripLinks(g.subtitle || "")),
  };
}
