// Edge wrapper around the OpenNext worker: canonical host + HTTPS before Next runs.
// @ts-ignore generated at build time by opennextjs-cloudflare
import handler from "./.open-next/worker.js";

// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const CANONICAL_HOST = "www.statsgh.com";
const REDIRECT_HOSTS = new Set(["statsgh.com", "www.statsgh.com"]);

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname) && (url.protocol === "http:" || url.hostname !== CANONICAL_HOST)) {
      url.protocol = "https:";
      url.hostname = CANONICAL_HOST;
      url.port = "";
      return new Response(null, { status: 301, headers: { Location: url.toString(), "Cache-Control": "public, max-age=3600" } });
    }
    return (handler as any).fetch(request, env, ctx);
  },
};
