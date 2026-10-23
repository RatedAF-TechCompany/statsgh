export const BACKLOG_LIMIT = 3;
export const BACKLOG_HOURS = 48;
export const MAX_ATTEMPTS = 3;
export const DEFAULT_MAX_ARTICLES_PER_RUN = 3;
export const RUN_WALL_CLOCK_MS = 110_000;
export const INTERRUPTED_RUN_ERROR = "Run did not complete (likely edge function timeout)";

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