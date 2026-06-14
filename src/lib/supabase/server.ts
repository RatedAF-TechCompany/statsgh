import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Simple server-side client for read-only data fetching.
// Uses the anon key; no cookie management needed for public data.
export function createReadOnlyServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
