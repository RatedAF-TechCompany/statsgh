import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple secret token for webhook security (prevents random calls)
const WEBHOOK_SECRET = "statsgh-newsroom-2026";

// This function can be called by external cron services (e.g., cron-job.org)
// URL: https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/newsroom-scheduled?token=statsgh-newsroom-2026
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple token verification for webhook security
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (token !== WEBHOOK_SECRET) {
      console.log('Invalid or missing webhook token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Scheduled newsroom scan triggered via webhook');

    // Call the main newsroom-scan function
    const response = await fetch(`${supabaseUrl}/functions/v1/newsroom-scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        triggerType: 'scheduled'
      }),
    });

    const result = await response.json();
    console.log('Scheduled scan result:', result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduled newsroom error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
