import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/adminCookie";

/**
 * Server-side guard for /admin routes. The client-side check in the admin
 * views stays in place; this makes sure non-admins never get the pages (or
 * their RSC payloads) from the server in the first place.
 *
 * 1. Read the access token mirrored into the statsgh-at cookie.
 * 2. Verify it with Supabase Auth (GET /auth/v1/user), so a forged or
 *    expired JWT is rejected.
 * 3. Check the admin role in public.user_roles using the user's own token
 *    (same query and RLS as the existing client-side check).
 */
export async function middleware(req: NextRequest) {
  const deny = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    const res = NextResponse.redirect(url);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  const token = req.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return deny();

  try {
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers, cache: "no-store" });
    if (!userRes.ok) return deny();
    const user = (await userRes.json()) as { id?: string };
    if (!user?.id) return deny();

    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`,
      { headers, cache: "no-store" },
    );
    if (!roleRes.ok) return deny();
    const rows = (await roleRes.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) return deny();
  } catch {
    return deny();
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
