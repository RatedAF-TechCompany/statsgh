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
  },
};
