// Moderated comments: store the comment unpublished; a database trigger emails the editors
// (public.sg_notifications -> officeofnajib@gmail.com). An editor publishes it by setting
// comments.is_published = true. No reader email is sent (the old Resend sandbox sender could not deliver).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ALLOWED = new Set(["https://www.statsgh.com", "https://statsgh.com"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(o) || o.startsWith("http://localhost") ? o : "https://www.statsgh.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const p = await req.json().catch(() => ({}));
    if (p.website) return reply(200, { success: true, moderated: true }); // honeypot: pretend success
    const articleId = String(p.articleId || "");
    const email = clean(p.email, 254).toLowerCase();
    const body = clean(p.body, 1001);
    const name = clean(p.name, 40) || "Reader";
    const parentId = p.parentId ? String(p.parentId) : null;
    if (!UUID.test(articleId) || (parentId && !UUID.test(parentId))) return reply(400, { error: "Invalid article." });
    if (!EMAIL.test(email)) return reply(400, { error: "Please enter a valid email address." });
    if (body.length < 2 || body.length > 1000) return reply(400, { error: "Comments must be between 2 and 1,000 characters." });

    const { data: art } = await supabase.from("articles").select("id").eq("id", articleId).eq("is_published", true).maybeSingle();
    if (!art) return reply(404, { error: "Article not found." });

    // Simple flood limits: 3 per email per 10 minutes, 100 site-wide per hour.
    const since10 = new Date(Date.now() - 600_000).toISOString();
    const since60 = new Date(Date.now() - 3_600_000).toISOString();
    const [{ count: mine }, { count: all }] = await Promise.all([
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since10),
      supabase.from("comments").select("id", { count: "exact", head: true }).gte("created_at", since60),
    ]);
    if ((mine ?? 0) >= 3 || (all ?? 0) >= 100) return reply(429, { error: "Too many comments right now. Please try again later." });

    const { error } = await supabase.from("comments").insert({
      article_id: articleId, name, email, body, parent_id: parentId, is_published: false,
    });
    if (error) { console.error("insert comment", error.message); return reply(500, { error: "Could not save your comment." }); }
    return reply(200, { success: true, moderated: true, message: "Thanks. Your comment will appear once an editor approves it." });
  } catch (e) {
    console.error("submit-comment", e);
    return reply(500, { error: "Could not save your comment." });
  }
});
