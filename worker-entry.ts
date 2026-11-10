// Edge wrapper around the OpenNext worker: canonical host + HTTPS before Next runs.
// @ts-ignore generated at build time by opennextjs-cloudflare
import handler from "./.open-next/worker.js";

import { SECTION_TO_CATEGORIES } from "./src/lib/sectionMapping";
import { DEFAULT_AUTHOR_SLUG, PUBLIC_AUTHOR_SLUGS } from "./src/lib/authorSlugs";

const KNOWN_SECTION_SLUGS = new Set<string>(Object.keys(SECTION_TO_CATEGORIES));
const isKnownSectionSlug = (s: string) => KNOWN_SECTION_SLUGS.has(s);

// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const CANONICAL_HOST = "www.statsgh.com";
const REDIRECT_HOSTS = new Set(["statsgh.com", "www.statsgh.com"]);

const SKIP = /^\/(_next|api|og|admin|auth|sitemaps|feeds|cdn-cgi)(\/|$)|\.[a-z0-9]{2,5}$/i;
const permanent = (loc: string) =>
  new Response(null, { status: 301, headers: { Location: loc, "Cache-Control": "public, max-age=3600" } });

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      let res = await handleFetch(request, env, ctx);
      // Social-card images must stay crawlable (no robots.txt block) but should not be indexed as pages.
      if (new URL(request.url).pathname.startsWith("/og/")) {
        res = new Response(res.body, res);
        res.headers.set("X-Robots-Tag", "noindex");
      }
      if (res.status >= 500 && res.status !== 503) {
        const u = new URL(request.url);
        ctx.waitUntil(reportError(env, `HTTP ${res.status} ${u.pathname.split("/").slice(0, 2).join("/") || "/"}`,
          `${request.method} ${u.pathname}${u.search}\nStatus: ${res.status}\nVersion: ${env.CF_VERSION_METADATA?.id || "?"}`));
      }
      return res;
    } catch (e: any) {
      const u = new URL(request.url);
      ctx.waitUntil(reportError(env, `Exception ${String(e?.name || "Error")}: ${String(e?.message || e).slice(0, 80)}`,
        `${request.method} ${u.pathname}${u.search}\nVersion: ${env.CF_VERSION_METADATA?.id || "?"}\n\n${String(e?.stack || e).slice(0, 4000)}`));
      throw e;
    }
  },
};

// ---- Error alerts: email officeofnajib@gmail.com via public.sg_notifications (max 1 per error type per hour) ----
const errorSeen = new Map<string, number>(); // per-isolate pre-filter; the database enforces the hourly limit globally
async function reportError(env: any, type: string, detail: string): Promise<void> {
  try {
    if (!env.SG_ALERT_SECRET) return;
    const t = Date.now();
    if ((errorSeen.get(type) ?? 0) > t - 3600_000) return;
    if (errorSeen.size > 500) errorSeen.clear();
    errorSeen.set(type, t);
    console.error("reportError", type);
    await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/sg_report_worker_error`, {
      method: "POST",
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.SG_ALERT_SECRET, p_type: type, p_detail: detail }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* alerting must never break a request */ }
}

// ---- Outbound editor email via the Cloudflare send_email binding (free; delivers only to verified addresses).
// statsgh.com mail is on Zoho, so Cloudflare Email Routing is NOT enabled there; the sender uses the account's
// routing-enabled domain. Called by public.sg_send_pending_notifications() with a shared secret (Vault + Worker secret).
const MAIL_FROM = { name: "StatsGH Alerts", email: "statsgh-alerts@ghanacrimes.com" };
async function internalMail(request: Request, env: any): Promise<Response> {
  if (!env.SG_MAIL_SECRET || request.headers.get("x-sg-mail") !== env.SG_MAIL_SECRET) return new Response("forbidden", { status: 403 });
  if (!env.EMAIL) return new Response("no email binding", { status: 500 });
  try {
    const m: any = await request.json();
    const r = await env.EMAIL.send({ to: String(m.to || "officeofnajib@gmail.com"), from: MAIL_FROM,
      subject: String(m.subject || "").slice(0, 180), text: String(m.text || ""), replyTo: "officeofnajib@gmail.com" });
    return Response.json({ id: r?.messageId || null });
  } catch (e: any) {
    return Response.json({ error: String(e?.code || ""), message: String(e?.message || e) }, { status: 502 });
  }
}

// ---- Site forms (contact, advertise, sponsored reports, fellowship, API, WhatsApp, fact-check claims).
// Cloudflare Turnstile (free) is verified here with the Worker secret TURNSTILE_SECRET; the row is written by
// public.sg_submit_form, which checks the Worker secret and applies per-email and site-wide rate limits.
const FORM_KINDS = new Set(["contact", "advertise", "sponsored", "fellowship", "api", "whatsapp", "factcheck"]);
const FORM_MSG: Record<string, string> = {
  bad_email: "Please enter a valid email address.", bad_input: "Please fill in your name and message.",
  rate_limited: "Too many messages just now. Please try again in a few minutes.", bad_kind: "Unknown form.",
};
async function submitForm(request: Request, env: any): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== "https://www.statsgh.com") return Response.json({ error: "Forbidden" }, { status: 403 });
  let b: any;
  try { b = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  if (b?.website) return Response.json({ ok: true }); // honeypot
  const kind = String(b?.kind || "");
  if (!FORM_KINDS.has(kind)) return Response.json({ error: FORM_MSG.bad_kind }, { status: 400 });
  if (!env.TURNSTILE_SECRET || !env.SG_ALERT_SECRET) return Response.json({ error: "Form temporarily unavailable." }, { status: 503 });
  const fd = new FormData();
  fd.append("secret", env.TURNSTILE_SECRET);
  fd.append("response", String(b?.token || ""));
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) fd.append("remoteip", ip);
  const ts: any = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd })
    .then((r) => r.json()).catch(() => ({ success: false }));
  if (!ts?.success) return Response.json({ error: "Please complete the security check and try again." }, { status: 400 });
  const s = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/sg_submit_form`, {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.SG_ALERT_SECRET, p_kind: kind, p_name: s(b.name, 100), p_email: s(b.email, 254),
      p_organisation: s(b.organisation, 150), p_subject: s(b.subject, 150), p_message: s(b.message, 3000) }),
  });
  const out = r.ok ? await r.json().catch(() => "error") : "error";
  if (out === "ok") return Response.json({ ok: true });
  return Response.json({ error: FORM_MSG[out] || "Could not send your message. Please email Officeofnajib@gmail.com instead." }, { status: out === "rate_limited" ? 429 : 400 });
}

const EDGE_REDIRECTS: Record<string, string> = {
  "/latest": "/news",
  "/apple-touch-icon.png": "/favicon.png",
  "/apple-touch-icon-precomposed.png": "/favicon.png",
};

// WordPress/PHP/secret-file probes and empty user agents get a cheap 403 before any SSR.
// (Cloudflare zone WAF rules would be better, but the deploy credential has zone read only.)
const PROBE = /^\/(wp-admin|wp-login|wp-content|wp-includes|wp-json|wordpress|xmlrpc|phpmyadmin|cgi-bin|vendor\/phpunit)(\/|\.|$)|\.(php\d?|asp|aspx|jsp|cgi|env|ini|sql|bak|git)(\/|$)|^\/\.(env|git|aws|ssh|htaccess|htpasswd|DS_Store)/i;
function isVerifiedBot(request: Request): boolean {
  const cf: any = (request as any).cf || {};
  return Boolean(cf.verifiedBotCategory || cf.botManagement?.verifiedBot);
}
const INDEXNOW_KEY = "f70a60bf3e4b687b44870e6ce7d2b987";

async function handleFetch(request: Request, env: any, ctx: any): Promise<Response> {
  {
    const url = new URL(request.url);
    if (!isVerifiedBot(request) && (PROBE.test(url.pathname) || !(request.headers.get("user-agent") || "").trim())) {
      return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "text/plain" } });
    }
    if (url.pathname.replace(/\/+$/, "") === "/indexnow" && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(INDEXNOW_KEY, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
    }
    if (REDIRECT_HOSTS.has(url.hostname) && (url.protocol === "http:" || url.hostname !== CANONICAL_HOST)) {
      url.protocol = "https:";
      url.hostname = CANONICAL_HOST;
      url.port = "";
      return new Response(null, { status: 301, headers: { Location: url.toString(), "Cache-Control": "public, max-age=3600" } });
    }
    // Single in-house byline (Abubakar Saddique): every other author profile 301s to his page.
    const m = url.pathname.match(/^\/authors\/([^/]+)\/?$/);
    if (m && !(PUBLIC_AUTHOR_SLUGS as readonly string[]).includes(m[1])) {
      return new Response(null, { status: 301, headers: { Location: `https://www.statsgh.com/authors/${DEFAULT_AUTHOR_SLUG}`, "Cache-Control": "public, max-age=3600" } });
    }
    if (url.pathname === "/__forms/submit") return request.method === "POST" ? submitForm(request, env) : new Response("not found", { status: 404 });
    if (url.pathname === "/__internal/mail") return request.method === "POST" ? internalMail(request, env) : new Response("not found", { status: 404 });
    const alias = EDGE_REDIRECTS[url.pathname.replace(/\/+$/, "") || "/"];
    if (alias && (request.method === "GET" || request.method === "HEAD")) return permanent(`https://${CANONICAL_HOST}${alias}`);
    if (url.pathname === "/api/revalidate") return revalidateAndPurge(request, url, env, ctx as any);
    if (!isCacheable(request, url)) return origin(request, url, env, ctx);
    return edgeCached(request, url, env, ctx as any);
  }
}

async function origin(request: Request, url: URL, env: unknown, ctx: unknown): Promise<Response> {
    const res: Response = await (handler as any).fetch(request, env, ctx);
    if (request.method !== "GET" && request.method !== "HEAD") return res;
    // Next emits 308 for permanent redirects; serve the conventional 301.
    if (res.status === 308) {
      const loc = res.headers.get("Location");
      if (loc) return permanent(loc);
    }
    // Old/unknown article URLs. Never send a reader to a different story:
    //  - /<listing>/<missing-slug> (the article route already tried same-story typo matches)
    //    301s to that listing page (or wherever that listing now redirects);
    //  - /article/<slug> is resolved by app/article/[slug];
    //  - any other multi-segment path whose last segment looks like a story slug 301s to /news;
    //  - everything else stays a real 404 (noindex), not a homepage redirect (soft 404).
    if (res.status === 404 && !SKIP.test(url.pathname)) {
      const segs = url.pathname.split("/").filter(Boolean);
      if (segs.length >= 2) {
        let target: string | null = null;
        if (segs[0] === "top-stories") {
          target = "/news"; // /top-stories itself redirects to /news
        } else if (isKnownSectionSlug(segs[0])) {
          // Top-level section: no need to render the section page just to probe it (saves a full SSR).
          target = `/${segs[0]}`;
        } else if (/^[a-z0-9-]+$/.test(segs[0]) && !/^\d+$/.test(segs[0]) && segs[0] !== "article") {
          const probe = new URL(`/${segs[0]}`, url);
          const sec: Response = await (handler as any).fetch(new Request(probe.toString(), { headers: request.headers }), env, ctx);
          if (sec.status === 200) target = `/${segs[0]}`;
          else if (sec.status === 301 || sec.status === 308) {
            const loc = sec.headers.get("Location");
            if (loc) target = new URL(loc, url).pathname;
          }
        }
        if (!target && /^[a-z0-9]+(-[a-z0-9]+){2,}$/i.test(segs[segs.length - 1])) target = "/news";
        if (target) return permanent(`https://${CANONICAL_HOST}${target}`);
      }
    }
    return res;
}

// Edge HTML cache (free Cache API), same pattern as GhanaCrimes fd55e6e: SSR CPU trips the
// Workers free-plan limit (1102/503) under crawler load, so anonymous GETs are served from
// the colo cache and refreshed in the background once older than 5 minutes.
const FRESH_SECONDS = 300;
const MAX_STALE_SECONDS = 86400;
// Generated OG/social images (satori + resvg, the most CPU-hungry route) never change for a
// given slug once published, so keep them fresh for a week instead of re-rendering every 5 min.
const OG_FRESH_SECONDS = 7 * 86400;
const OG_MAX_STALE_SECONDS = 30 * 86400;
// Cache 404s briefly so crawler storms on dead/legacy URLs (wp-*, *.php) don't SSR every hit.
const NOT_FOUND_FRESH_SECONDS = 600;

function freshSeconds(url: URL, status: number): number {
  if (status === 404) return NOT_FOUND_FRESH_SECONDS;
  if (url.pathname.startsWith("/og/")) return OG_FRESH_SECONDS;
  return FRESH_SECONDS;
}
const NO_CACHE_PREFIXES = ["/admin", "/api", "/auth", "/_next/data", "/reader", "/search", "/verify-comment", "/newsletter/preferences", "/news-sitemap.xml", "/sitemap.xml", "/sitemaps/", "/feed.xml", "/feeds/"];
const TRACKING = /^(utm_|fbclid$|gclid$|ref$|s$|t$)/;

function isCacheable(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;
  if (NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
  if (url.searchParams.has("_rsc") || request.headers.has("rsc") || request.headers.has("next-router-state-tree")) return false;
  if (/sb-|auth/i.test(request.headers.get("cookie") || "")) return false;
  return true;
}

// Bump CACHE_GEN to drop every edge HTML copy at once (zone purge isn't available to the deploy token).
const CACHE_GEN = "4";
function cacheKey(url: URL): Request {
  const k = new URL(url.toString());
  k.searchParams.set("__gen", CACHE_GEN);
  for (const name of [...k.searchParams.keys()]) if (TRACKING.test(name)) k.searchParams.delete(name);
  return new Request(k.toString(), { method: "GET" });
}

async function fetchAndStore(request: Request, url: URL, key: Request, env: unknown, ctx: any): Promise<Response> {
  const res = await origin(request, url, env, ctx);
  const noStore = /no-store|private/i.test(res.headers.get("cache-control") || "");
  if ((res.status === 200 || res.status === 301 || res.status === 404) && !res.headers.has("set-cookie") && !noStore) {
    const copy = new Response(res.clone().body, res);
    const og = url.pathname.startsWith("/og/");
    copy.headers.set("x-edge-cached-at", String(Date.now()));
    copy.headers.set("x-edge-fresh", String(freshSeconds(url, res.status)));
    copy.headers.set("Cache-Control", `public, max-age=${res.status === 404 ? NOT_FOUND_FRESH_SECONDS : og ? OG_MAX_STALE_SECONDS : MAX_STALE_SECONDS}`);
    ctx.waitUntil((caches as any).default.put(key, copy));
  }
  return res;
}

async function edgeCached(request: Request, url: URL, env: unknown, ctx: any): Promise<Response> {
  const key = cacheKey(url);
  const cache = (caches as any).default as Cache;
  const hit = await cache.match(key);
  if (hit) {
    const age = (Date.now() - Number(hit.headers.get("x-edge-cached-at") || 0)) / 1000;
    const fresh = Number(hit.headers.get("x-edge-fresh") || FRESH_SECONDS);
    const out = new Response(hit.body, hit);
    out.headers.delete("x-edge-fresh");
    out.headers.set("Cache-Control", url.pathname.startsWith("/og/") ? "public, max-age=86400" : "public, max-age=0, must-revalidate");
    out.headers.set("x-edge-cache", age > fresh ? "STALE" : "HIT");
    if (age > fresh) ctx.waitUntil(fetchAndStore(request.clone(), url, key, env, ctx).catch(() => {}));
    return out;
  }
  return fetchAndStore(request, url, key, env, ctx);
}

// Publishing: let Next revalidate as before, then drop the edge copies of the home,
// section and article pages so the new story shows without waiting for the 5-min window.
async function revalidateAndPurge(request: Request, url: URL, env: unknown, ctx: any): Promise<Response> {
  const res: Response = await (handler as any).fetch(request, env, ctx);
  if (res.status !== 200) return res;
  try {
    const body = await res.clone().json();
    const paths = ["/", "/top-stories", "/news", "/feed.xml"];
    if (typeof body?.article === "string") paths.push(body.article, "/" + body.article.split("/")[1]);
    const cache = (caches as any).default as Cache;
    await Promise.all(paths.map((p) => cache.delete(cacheKey(new URL(`https://${CANONICAL_HOST}${p}`)))));
  } catch {}
  return res;
}
