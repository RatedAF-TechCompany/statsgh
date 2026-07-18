// Shared AI gateway wrapper. Every AI call in every edge function goes through
// callGateway — enforces JSON mode where expected, explicit max_tokens, explicit
// temperature, per-call usage capture, and safe-fail on 402/429. Never call the
// gateway directly from a function.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type GatewayHaltReason = "credits_exhausted" | "rate_limited";

export class GatewayHaltError extends Error {
  constructor(public reason: GatewayHaltReason, public status: number, message: string) {
    super(message);
    this.name = "GatewayHaltError";
  }
}

export interface UsageAccumulator {
  ai_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  json_parse_failures: number;
  halted: false | GatewayHaltReason;
  halt_status?: number;
}

export function createUsage(): UsageAccumulator {
  return {
    ai_calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    json_parse_failures: 0,
    halted: false,
  };
}

// Rough per-1k-token pricing (USD). Used only for approximate cost visibility.
const PRICES: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash": { in: 0.000075, out: 0.0003 },
  "google/gemini-2.5-flash-lite": { in: 0.0000375, out: 0.00015 },
  "google/gemini-3-flash-preview": { in: 0.000075, out: 0.0003 },
  "google/gemini-2.5-pro": { in: 0.00125, out: 0.005 },
  "openai/gpt-4o": { in: 0.0025, out: 0.01 },
  "google/gemini-2.5-flash-image-preview": { in: 0.000075, out: 0.0003 },
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICES[model] ?? { in: 0.0001, out: 0.0004 };
  return (promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out;
}

export interface CallGatewayOpts {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: any }>;
  max_tokens: number;
  temperature: number;
  json?: boolean; // request JSON object response_format
  usage?: UsageAccumulator;
  extra?: Record<string, unknown>; // e.g. modalities for image models
}

export interface CallGatewayResult {
  content: string;
  raw: any;
  prompt_tokens: number;
  completion_tokens: number;
}

export async function callGateway(opts: CallGatewayOpts): Promise<CallGatewayResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  // Short-circuit: if a prior call this run halted on credits/rate-limit, do not
  // burn more attempts. Caller must observe usage.halted.
  if (opts.usage?.halted) {
    throw new GatewayHaltError(opts.usage.halted, opts.usage.halt_status ?? 0, "Halted earlier in run");
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.max_tokens,
    temperature: opts.temperature,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    ...(opts.extra ?? {}),
  };

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 402 || resp.status === 429) {
    const reason: GatewayHaltReason = resp.status === 402 ? "credits_exhausted" : "rate_limited";
    if (opts.usage) {
      opts.usage.halted = reason;
      opts.usage.halt_status = resp.status;
    }
    throw new GatewayHaltError(reason, resp.status, `Gateway ${resp.status}`);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Gateway ${resp.status}: ${text.substring(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage ?? {};
  const promptTok = Number(usage.prompt_tokens ?? 0);
  const completionTok = Number(usage.completion_tokens ?? 0);

  if (opts.usage) {
    opts.usage.ai_calls += 1;
    opts.usage.prompt_tokens += promptTok;
    opts.usage.completion_tokens += completionTok;
  }

  return { content, raw: data, prompt_tokens: promptTok, completion_tokens: completionTok };
}

// Strict JSON parser — never uses regex extraction. Trims code fences if the
// model wrapped output; anything else is a parse failure.
export function parseJson<T = any>(content: string, usage?: UsageAccumulator): T {
  const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    if (usage) usage.json_parse_failures += 1;
    throw new Error(`JSON parse failed: ${(err as Error).message}`);
  }
}

// Convenience: call in JSON mode and parse. On failure caller may retry once
// with a larger token budget (see article-generation callers).
export async function callGatewayJson<T = any>(opts: CallGatewayOpts): Promise<T> {
  const { content } = await callGateway({ ...opts, json: true });
  return parseJson<T>(content, opts.usage);
}

// Deterministic content hashing for ai_rejects / dedupe.
export async function sha1(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeTitle(title: string): string {
  return (title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Cheap deterministic scope gate. Returns:
//   "accept" — obviously in-scope Ghana business/economic story, skip AI filter
//   "reject" — obviously out-of-scope (sports, entertainment, celebrity)
//   "unknown" — send to the AI classifier
const HARD_REJECT_KEYWORDS = [
  "kardashian", "beyonc", "premier league", "arsenal", "manchester united",
  "chelsea fc", "liverpool fc", "afcon final", "wwe", "ufc", "boxing",
  "movie", "netflix", "hollywood", "nollywood", "grammy", "oscar ",
  "beauty pageant", "miss universe", "afrobeats", "concert", "album drop",
];
const HARD_ACCEPT_KEYWORDS = [
  "bank of ghana", "bog ", "cedi", "ghs ", "inflation", "gdp", "ghana stock exchange",
  "gse ", "monetary policy", "policy rate", "eurobond", "treasury bill", "cocoa",
  "cocobod", "vra ", "eci ", "ministry of finance", "world bank ghana", "imf ghana",
  "public debt", "budget statement", "petroleum", "prices at the pump",
];

export function scopeGate(title: string, snippet = ""): "accept" | "reject" | "unknown" {
  const t = (title + " " + snippet).toLowerCase();
  for (const kw of HARD_REJECT_KEYWORDS) if (t.includes(kw)) return "reject";
  for (const kw of HARD_ACCEPT_KEYWORDS) if (t.includes(kw)) return "accept";
  return "unknown";
}
