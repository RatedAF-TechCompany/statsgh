/**
 * Name of the cookie that mirrors the Supabase access token so the server
 * (middleware) can verify the session before serving /admin routes.
 *
 * The Supabase session itself still lives in localStorage (or the Lovable
 * preview broker); this cookie only carries the short-lived access JWT,
 * which is already readable by page scripts, so it adds no new exposure.
 */
export const ADMIN_TOKEN_COOKIE = "statsgh-at";
