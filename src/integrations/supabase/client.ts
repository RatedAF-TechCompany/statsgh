// Browser-side Supabase client
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { ADMIN_TOKEN_COOKIE } from '@/lib/auth/adminCookie';

// Use Next.js environment variables (works in both client and server contexts)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});;

// Mirror the access token into a first-party cookie so middleware can verify
// the session and admin role server-side before serving /admin routes.
if (typeof window !== 'undefined') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  supabase.auth.onAuthStateChange((_event, session) => {
    try {
      if (session?.access_token) {
        const maxAge = Math.max(60, (session.expires_at ?? 0) - Math.floor(Date.now() / 1000));
        document.cookie = `${ADMIN_TOKEN_COOKIE}=${session.access_token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
      } else {
        document.cookie = `${ADMIN_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
      }
    } catch { /* cookies disabled: server guard will redirect to /auth */ }
  });
}
