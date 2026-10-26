// Edge wrapper around the OpenNext worker: canonical host + HTTPS before Next runs.
// @ts-ignore generated at build time by opennextjs-cloudflare
import handler from "./.open-next/worker.js";

// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const CANONICAL_HOST = "www.statsgh.com";
const REDIRECT_HOSTS = new Set(["statsgh.com", "www.statsgh.com"]);

const SKIP = /^\/(_next|api|og|admin|auth|sitemaps|feeds|cdn-cgi)(\/|$)|\.[a-z0-9]{2,5}$/i;
const permanent = (loc: string) =>
  new Response(null, { status: 301, headers: { Location: loc, "Cache-Control": "public, max-age=3600" } });

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname) && (url.protocol === "http:" || url.hostname !== CANONICAL_HOST)) {
      url.protocol = "https:";
      url.hostname = CANONICAL_HOST;
      url.port = "";
      return new Response(null, { status: 301, headers: { Location: url.toString(), "Cache-Control": "public, max-age=3600" } });
    }
    // Single organisation byline: retired author profiles 301 to the newsroom page.
    const m = url.pathname.match(/^\/authors\/([^/]+)\/?$/);
    if (m && m[1] !== "statsgh-newsroom") {
      return new Response(null, { status: 301, headers: { Location: "https://www.statsgh.com/authors/statsgh-newsroom", "Cache-Control": "public, max-age=3600" } });
    }
    if (url.pathname === "/api/revalidate") return revalidateAndPurge(request, url, env, ctx as any);
    if (!isCacheable(request, url)) return origin(request, url, env, ctx);
    return edgeCached(request, url, env, ctx as any);
  },
};

async function origin(request: Request, url: URL, env: unknown, ctx: unknown): Promise<Response> {
    const res: Response = await (handler as any).fetch(request, env, ctx);
    if (request.method !== "GET" && request.method !== "HEAD") return res;
    // Next emits 308 for permanent redirects; serve the conventional 301.
    if (res.status === 308) {
      const loc = res.headers.get("Location");
      if (loc) return permanent(loc);
    }
    // Old article URLs (archive not migrated): unknown /<section>/<slug>, /article/<slug>
    // and dated WordPress-style paths 301 to their section page, else the homepage.
    if (res.status === 404 && !SKIP.test(url.pathname)) {
      const segs = url.pathname.split("/").filter(Boolean);
      if (segs.length >= 2 || /^\/article\//.test(url.pathname)) {
        let target = "/";
        if (/^[a-z0-9-]+$/.test(segs[0]) && !/^\d+$/.test(segs[0]) && segs[0] !== "article") {
          const probe = new URL(`/${segs[0]}`, url);
          const sec: Response = await (handler as any).fetch(new Request(probe.toString(), { headers: request.headers }), env, ctx);
          if (sec.status === 200) target = `/${segs[0]}`;
        }
        return permanent(`https://${CANONICAL_HOST}${target}`);
      }
    }
    return res;
}

// Edge HTML cache (free Cache API), same pattern as GhanaCrimes fd55e6e: SSR CPU trips the
// Workers free-plan limit (1102/503) under crawler load, so anonymous GETs are served from
// the colo cache and refreshed in the background once older than 5 minutes.
const FRESH_SECONDS = 300;
const MAX_STALE_SECONDS = 86400;
const NO_CACHE_PREFIXES = ["/admin", "/api", "/auth", "/_next/data", "/reader", "/search", "/verify-comment", "/newsletter/preferences"];
const TRACKING = /^(utm_|fbclid$|gclid$|ref$|s$|t$)/;

function isCacheable(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;
  if (NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
  if (url.searchParams.has("_rsc") || request.headers.has("rsc") || request.headers.has("next-router-state-tree")) return false;
  if (/sb-|auth/i.test(request.headers.get("cookie") || "")) return false;
  return true;
}

function cacheKey(url: URL): Request {
  const k = new URL(url.toString());
  for (const name of [...k.searchParams.keys()]) if (TRACKING.test(name)) k.searchParams.delete(name);
  return new Request(k.toString(), { method: "GET" });
}

async function fetchAndStore(request: Request, url: URL, key: Request, env: unknown, ctx: any): Promise<Response> {
  const res = await origin(request, url, env, ctx);
  if ((res.status === 200 || res.status === 301) && !res.headers.has("set-cookie")) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("x-edge-cached-at", String(Date.now()));
    copy.headers.set("Cache-Control", `public, max-age=${MAX_STALE_SECONDS}`);
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
    const out = new Response(hit.body, hit);
    out.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    out.headers.set("x-edge-cache", age > FRESH_SECONDS ? "STALE" : "HIT");
    if (age > FRESH_SECONDS) ctx.waitUntil(fetchAndStore(request.clone(), url, key, env, ctx).catch(() => {}));
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
    const paths = ["/", "/top-stories"];
    if (typeof body?.article === "string") paths.push(body.article, "/" + body.article.split("/")[1]);
    const cache = (caches as any).default as Cache;
    await Promise.all(paths.map((p) => cache.delete(new Request(`https://${CANONICAL_HOST}${p}`, { method: "GET" }))));
  } catch {}
  return res;
}
