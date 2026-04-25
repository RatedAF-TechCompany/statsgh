const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sitemaps = [
      'https://statsgh.com/sitemap.xml',
      'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/main-sitemap',
      'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/news-sitemap',
    ];

    const results = [];
    for (const sitemap of sitemaps) {
      const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`;
      const res = await fetch(url);
      results.push({ sitemap, status: res.status, ok: res.ok });
      console.log(`Pinged Google for ${sitemap}: ${res.status}`);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error submitting sitemap:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
