// Global kill-switch for ALL automated tweet generation and X posting.
// The flag lives in public.system_flags (key = 'AUTO_TWEET_ENABLED').
// Every tweet-related function must call this FIRST and exit before any
// Gemini call, tweet_queue insert or X API request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const AUTO_TWEET_DISABLED_BODY = {
  success: false,
  halted: true,
  code: "AUTO_TWEET_DISABLED",
  message:
    "Automated tweet generation and X posting are disabled (AUTO_TWEET_ENABLED = false). No AI call, no queue insert, no X API call was made.",
};

export async function autoTweetEnabled(): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("system_flags")
      .select("enabled")
      .eq("key", "AUTO_TWEET_ENABLED")
      .maybeSingle();
    // Fail closed: anything other than an explicit true keeps automation off.
    return data?.enabled === true;
  } catch (_e) {
    return false;
  }
}

export function autoTweetDisabledResponse(corsHeaders: Record<string, string>): Response {
  console.log("AUTO_TWEET_DISABLED");
  return new Response(JSON.stringify(AUTO_TWEET_DISABLED_BODY), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
