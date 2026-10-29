// OpenAI-compatible proxy: StatsGH + GhanaCrimes edge functions -> Cloudflare Workers AI (free tier).
// - Auth: Bearer AI_API_KEY (bucket "statsgh") or GC_AI_API_KEY (bucket "ghanacrimes").
// - Maps legacy Gemini/OpenAI model names to Workers AI models; drops grounding tools.
// - Refuses image generation (no paid image models) so callers fall back to og:image / no image.
// - Enforces a daily neuron budget per bucket (Workers AI free tier = 10k neurons/day, reset 00:00 UTC).
import { createClient } from "npm:@supabase/supabase-js@2";

const STRONG = Deno.env.get("AI_MODEL") ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const LIGHT = Deno.env.get("AI_MODEL_LIGHT") ?? "@cf/meta/llama-4-scout-17b-16e-instruct";
const CAPS: Record<string, number> = {
  statsgh: Number(Deno.env.get("AI_CAP_STATSGH") ?? 5500),
  ghanacrimes: Number(Deno.env.get("AI_CAP_GHANACRIMES") ?? 3500),
};
const MAX_TOKENS = Number(Deno.env.get("AI_MAX_TOKENS") ?? 3000);

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function eq(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}

function mapModel(m: unknown): string {
  const s = String(m ?? "");
  if (s.startsWith("@cf/")) return s;
  if (/(-lite|-nano|-mini)\b/i.test(s)) return LIGHT;
  return STRONG;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
    || (req.headers.get("Lovable-API-Key") ?? "").trim();
  let bucket = "";
  if (eq(bearer, Deno.env.get("AI_API_KEY") ?? "")) bucket = "statsgh";
  else if (eq(bearer, Deno.env.get("GC_AI_API_KEY") ?? "")) bucket = "ghanacrimes";
  if (!bucket) return json({ error: { message: "Unauthorized" } }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: { message: "Bad JSON" } }, 400); }

  if (Array.isArray(body.modalities) && body.modalities.includes("image") || /image/i.test(String(body.model ?? ""))) {
    return json({ error: { message: "Image generation disabled (free tier): use source og:image or no image" } }, 400);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const today = new Date().toISOString().slice(0, 10);
  const { data: row } = await db.from("ai_proxy_usage").select("neurons").eq("day", today).eq("bucket", bucket).maybeSingle();
  if (Number(row?.neurons ?? 0) >= CAPS[bucket]) {
    await db.rpc("ai_proxy_add", { p_bucket: bucket, p_neurons: 0, p_refused: 1 });
    return json({ error: { message: `Daily AI budget reached for ${bucket}` } }, 429);
  }

  const out = {
    model: mapModel(body.model),
    messages: body.messages,
    max_tokens: Math.min(Number(body.max_tokens ?? body.max_completion_tokens ?? MAX_TOKENS), MAX_TOKENS),
    ...(body.temperature != null ? { temperature: body.temperature } : {}),
    ...(body.response_format?.type === "json_object" ? { response_format: { type: "json_object" } } : {}),
    ...(Array.isArray(body.tools) && body.tools.some((t: { type?: string }) => t?.type === "function")
      ? { tools: body.tools.filter((t: { type?: string }) => t?.type === "function"), ...(body.tool_choice ? { tool_choice: body.tool_choice } : {}) }
      : {}),
  };
  const acct = Deno.env.get("CF_ACCOUNT_ID")!;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("CF_AI_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify(out),
  });
  const text = await res.text();
  let neurons = 0;
  try { const j = JSON.parse(text); neurons = Number(j?.usage?.neurons ?? 0) || ((j?.usage?.prompt_tokens ?? 0) * 0.027 + (j?.usage?.completion_tokens ?? 0) * 0.205); } catch { /* ignore */ }
  if (neurons > 0) await db.rpc("ai_proxy_add", { p_bucket: bucket, p_neurons: neurons });
  return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
});
