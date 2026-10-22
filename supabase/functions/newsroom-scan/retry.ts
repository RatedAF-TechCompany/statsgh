export const BACKLOG_LIMIT = 16;
export const BACKLOG_HOURS = 48;
export const MAX_ATTEMPTS = 3;

export function failureState(attempts: number, message: string) {
  return {
    attempts,
    processing_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
    dead_letter: attempts >= MAX_ATTEMPTS,
    error_message: message.slice(0, 500),
  };
}

// Preserve the existing 2200-token JSON retry, then one final AI retry.
// No RSS text is ever substituted for a failed generation.
export async function writeWithRetries(
  call: (maxTokens: number) => Promise<string>,
  parse: (content: string) => any,
  isHalt: (error: unknown) => boolean,
) {
  let lastError: unknown;
  for (const maxTokens of [1500, 2200, 2200]) {
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