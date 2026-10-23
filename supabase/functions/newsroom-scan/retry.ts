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
      const generated = parse(content);
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