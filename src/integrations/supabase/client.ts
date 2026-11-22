// Supabase client facade (stage 3 loading rework, 15 Nov 2026).
//
// Anonymous reads (`supabase.from(...).select(...)...` and `supabase.rpc(...)`) go straight to the
// PostgREST API with a few hundred bytes of code, so public pages no longer download supabase-js
// (~64 KB gz) before first paint. Everything else is delegated, unchanged, to the real client in
// ./client-full, which is loaded on demand:
//   - any write (insert/update/upsert/delete) or a query method this file does not implement;
//   - any query while a signed-in session exists (so RLS sees the user's token, as before);
//   - auth calls other than a signed-out getSession/getUser, edge functions and storage.
// The URL/filter encoding mirrors @supabase/postgrest-js 2.x exactly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/adminCookie";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PROJECT_REF = (() => { try { return new URL(SUPABASE_URL).hostname.split(".")[0]; } catch { return ""; } })();
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;

type Full = SupabaseClient<Database>;
let fullPromise: Promise<Full> | null = null;
export function loadFullClient(): Promise<Full> {
  const start = () => (fullPromise = import("./client-full").then((m) => m.supabase as unknown as Full));
  if (!fullPromise) return start();
  // On Cloudflare Workers a pending promise started by a request that was then cancelled can never
  // settle; drop a failed shared load and load again inside this request (once).
  const shared = fullPromise;
  return shared.catch(() => { if (fullPromise === shared) fullPromise = null; return start(); });
}

/** True when a session may exist (or we cannot tell), so the real client must handle the call. */
function maybeSignedIn(): boolean {
  if (typeof window === "undefined") return false; // server: always anonymous
  try {
    if (window.parent && window.parent !== window) return true; // framed (editor preview): brokered storage
    return !!window.localStorage.getItem(AUTH_KEY);
  } catch {
    return true;
  }
}

// A stored session means the real client must run (it refreshes the token and mirrors it into the
// admin cookie). Signed out: clear a stale admin cookie exactly as the real client did on load.
if (typeof window !== "undefined") {
  if (maybeSignedIn()) {
    const start = () => { void loadFullClient(); };
    if ("requestIdleCallback" in window) (window as any).requestIdleCallback(start, { timeout: 3000 }); else setTimeout(start, 1500);
  } else if (document.cookie.includes(`${ADMIN_TOKEN_COOKIE}=`)) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ADMIN_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
}

type Call = { m: string; a: any[] };
const LITE = new Set([
  "select", "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "overlaps",
  "match", "not", "or", "filter", "order", "limit", "range", "single", "maybeSingle", "abortSignal", "returns",
]);
const RESERVED = /[,()]/;

function replay(target: any, calls: Call[]) {
  return calls.reduce((b, c) => b[c.m](...c.a), target);
}

async function runLite(table: string, calls: Call[]) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  const sp = url.searchParams;
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  let method = "GET";
  let single = false, maybeSingle = false, countMode: string | undefined;
  let signal: AbortSignal | undefined;
  const sel = (cols?: string) => {
    let q = false;
    return (cols ?? "*").split("").map((c) => { if (/\s/.test(c) && !q) return ""; if (c === '"') q = !q; return c; }).join("");
  };
  for (const { m, a } of calls) {
    switch (m) {
      case "select": { sp.set("select", sel(a[0])); const o = a[1] || {}; if (o.head) method = "HEAD"; if (o.count) countMode = o.count; break; }
      case "eq": case "neq": case "gt": case "gte": case "lt": case "lte": case "like": case "ilike": case "is":
        sp.append(a[0], `${m}.${a[1]}`); break;
      case "in": {
        const v = Array.from(new Set(a[1] as any[])).map((s) => (typeof s === "string" && RESERVED.test(s) ? `"${s}"` : `${s}`)).join(",");
        sp.append(a[0], `in.(${v})`); break;
      }
      case "contains": { const v = a[1]; sp.append(a[0], typeof v === "string" ? `cs.${v}` : Array.isArray(v) ? `cs.{${v.join(",")}}` : `cs.${JSON.stringify(v)}`); break; }
      case "overlaps": { const v = a[1]; sp.append(a[0], typeof v === "string" ? `ov.${v}` : `ov.{${v.join(",")}}`); break; }
      case "match": Object.entries(a[0] || {}).forEach(([k, v]) => { if (v !== undefined) sp.append(k, `eq.${v}`); }); break;
      case "not": sp.append(a[0], `not.${a[1]}.${a[2]}`); break;
      case "filter": sp.append(a[0], `${a[1]}.${a[2]}`); break;
      case "or": { const o = a[1] || {}; const ref = o.referencedTable ?? o.foreignTable; sp.append(ref ? `${ref}.or` : "or", `(${a[0]})`); break; }
      case "order": {
        const o = a[1] || {}; const ref = o.referencedTable ?? o.foreignTable; const key = ref ? `${ref}.order` : "order";
        const asc = o.ascending === undefined ? true : o.ascending; const ex = sp.get(key);
        sp.set(key, `${ex ? `${ex},` : ""}${a[0]}.${asc ? "asc" : "desc"}${o.nullsFirst === undefined ? "" : o.nullsFirst ? ".nullsfirst" : ".nullslast"}`);
        break;
      }
      case "limit": { const o = a[1] || {}; const ref = o.referencedTable ?? o.foreignTable; sp.set(ref === undefined ? "limit" : `${ref}.limit`, `${a[0]}`); break; }
      case "range": {
        const o = a[2] || {}; const ref = o.referencedTable ?? o.foreignTable;
        sp.set(ref === undefined ? "offset" : `${ref}.offset`, `${a[0]}`); sp.set(ref === undefined ? "limit" : `${ref}.limit`, `${a[1] - a[0] + 1}`); break;
      }
      case "single": single = true; break;
      case "maybeSingle": maybeSingle = true; break;
      case "abortSignal": signal = a[0]; break;
      case "returns": break;
    }
  }
  if (!sp.has("select")) sp.set("select", "*");
  if (countMode) headers.Prefer = `count=${countMode}`;
  if (single) headers.Accept = "application/vnd.pgrst.object+json";
  return guarded(() => fetch(url.toString(), { method, headers, signal: signal ?? serverSignal() }), { maybeSingle, countMode, head: method === "HEAD" });
}

// Server renders must not hang or throw when the database is slow or down (22 Nov 2026: Disk IO
// budget exhaustion made PostgREST stall for 90s+). Server-side reads time out after 8s, and a
// network failure or timeout comes back as { error } (same shape supabase-js uses) instead of
// throwing, so pages fall back to their empty/client-loaded state rather than a 500.
const SERVER_FETCH_TIMEOUT_MS = 8000;
function serverSignal(): AbortSignal | undefined {
  if (typeof window !== "undefined") return undefined;
  try { return AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS); } catch { return undefined; }
}
async function guarded(doFetch: () => Promise<Response>, o: { maybeSingle?: boolean; countMode?: string; head?: boolean }) {
  let res: Response;
  try {
    res = await doFetch();
  } catch (e: any) {
    if (typeof window !== "undefined") throw e; // browser behaviour unchanged
    const message = `${e?.name || "Error"}: ${e?.message || e}`;
    return { error: { message, details: "", hint: "", code: "" }, data: null, count: null, status: 0, statusText: "" };
  }
  try {
    return await finish(res, o);
  } catch (e: any) {
    if (typeof window !== "undefined") throw e;
    return { error: { message: String(e?.message || e), details: "", hint: "", code: "" }, data: null, count: null, status: 0, statusText: "" };
  }
}

async function finish(res: Response, o: { maybeSingle?: boolean; countMode?: string; head?: boolean }) {
  let data: any = null, error: any = null, count: number | null = null, status = res.status, statusText = res.statusText;
  if (res.ok) {
    if (!o.head) {
      const body = await res.text();
      if (body !== "") { try { data = JSON.parse(body); } catch { data = null; error = { message: body }; } }
    }
    const cr = res.headers.get("content-range")?.split("/");
    if (o.countMode && cr && cr.length > 1) count = parseInt(cr[1]);
    if (o.maybeSingle && Array.isArray(data)) {
      if (data.length > 1) {
        error = { code: "PGRST116", details: `Results contain ${data.length} rows, application/vnd.pgrst.object+json requires 1 row`, hint: null, message: "JSON object requested, multiple (or no) rows returned" };
        data = null; count = null; status = 406; statusText = "Not Acceptable";
      } else data = data.length === 1 ? data[0] : null;
    }
  } else {
    const body = await res.text();
    try {
      error = JSON.parse(body);
      if (Array.isArray(error) && res.status === 404) { data = []; error = null; status = 200; statusText = "OK"; }
    } catch {
      if (res.status === 404 && body === "") { status = 204; statusText = "No Content"; } else error = { message: body };
    }
    if (error && o.maybeSingle && error?.details?.includes?.("0 rows")) { error = null; status = 200; statusText = "OK"; }
  }
  return { error, data, count, status, statusText };
}

/** Query builder that records the chain, then runs it lite (anonymous read) or on the real client. */
function builder(table: string, calls: Call[] = []): any {
  const run = () => {
    const lite = calls.length > 0 && calls[0].m === "select" && calls.every((c) => LITE.has(c.m)) && !maybeSignedIn();
    return lite ? runLite(table, calls) : loadFullClient().then((c) => replay((c as any).from(table), calls));
  };
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === "then") return (res: any, rej: any) => run().then(res, rej);
      if (prop === "catch") return (rej: any) => run().catch(rej);
      if (prop === "finally") return (f: any) => run().finally(f);
      if (typeof prop !== "string") return undefined;
      return (...a: any[]) => builder(table, [...calls, { m: prop, a }]);
    },
  });
}

async function rpcLite(fn: string, args: any, opts: any = {}) {
  if (opts.head || opts.get || opts.count) return loadFullClient().then((c) => (c as any).rpc(fn, args, opts));
  return guarded(() => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
    signal: serverSignal(),
  }), {});
}

function rpcBuilder(fn: string, args: any, opts: any, calls: Call[] = []): any {
  const run = () =>
    calls.length === 0 && !maybeSignedIn()
      ? rpcLite(fn, args, opts)
      : loadFullClient().then((c) => replay((c as any).rpc(fn, args, opts), calls));
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === "then") return (res: any, rej: any) => run().then(res, rej);
      if (prop === "catch") return (rej: any) => run().catch(rej);
      if (typeof prop !== "string") return undefined;
      return (...a: any[]) => rpcBuilder(fn, args, opts, [...calls, { m: prop, a }]);
    },
  });
}

const auth = new Proxy({}, {
  get(_t, prop) {
    if (typeof prop !== "string") return undefined;
    if (prop === "onAuthStateChange") {
      return (cb: any) => {
        let sub: any = null; let dead = false;
        loadFullClient().then((c) => { if (!dead) sub = c.auth.onAuthStateChange(cb).data.subscription; });
        return { data: { subscription: { id: "lazy", callback: cb, unsubscribe: () => { dead = true; sub?.unsubscribe(); } } } };
      };
    }
    if (prop === "getSession" && !maybeSignedIn()) return async () => ({ data: { session: null }, error: null });
    if (prop === "getUser" && !maybeSignedIn()) return async () => ({ data: { user: null }, error: null });
    return (...a: any[]) => loadFullClient().then((c) => (c.auth as any)[prop](...a));
  },
});

const functions = { invoke: (...a: any[]) => loadFullClient().then((c) => (c.functions as any).invoke(...a)) };

export const supabase = {
  from: (table: string) => builder(table),
  rpc: (fn: string, args?: any, opts?: any) => rpcBuilder(fn, args, opts),
  auth,
  functions,
  // Storage is used only by admin upload screens, which import ./client-full directly.
} as unknown as Full;
