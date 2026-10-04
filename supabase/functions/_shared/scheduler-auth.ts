// Caller authentication for newsroom functions.
// Accepted: Bearer <SUPABASE_SERVICE_ROLE_KEY>, Bearer <CRON_SECRET env>, Bearer <database scheduler token>
// (private.scheduler_auth, checked via verify_scheduler_token RPC), or a signed-in admin/editor (manual admin button).
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function authorizeCaller(req: Request, admin: SupabaseClient): Promise<{ ok: boolean; via: string; userId: string | null }> {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { ok: false, via: "none", userId: null };
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (safeEqual(bearer, serviceKey)) return { ok: true, via: "service_role", userId: null };
  if (cronSecret && safeEqual(bearer, cronSecret)) return { ok: true, via: "cron_secret_env", userId: null };
  if (/^[0-9a-f]{64}$/.test(bearer)) {
    const { data } = await admin.rpc("verify_scheduler_token" as never, { p_token: bearer } as never);
    if (data === true) return { ok: true, via: "scheduler_token", userId: null };
    return { ok: false, via: "bad_token", userId: null };
  }
  const { data: { user } } = await admin.auth.getUser(bearer);
  if (!user) return { ok: false, via: "invalid_jwt", userId: null };
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "editor"]);
  if (roles && roles.length) return { ok: true, via: "admin_user", userId: user.id };
  return { ok: false, via: "non_admin_user", userId: user.id };
}
