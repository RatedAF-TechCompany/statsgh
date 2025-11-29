import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get all published articles
    const { data: articles, error } = await supabase
      .from('articles')
      .select('slug, category_slug, updated_at, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }

    // Define category pages
    const categories = [
      'top-stories',
      'economy-inflation',
      'public-finance',
      'labour-salaries',
      'agriculture-food',
      'energy-resources',
      'trade-investment',
      'health-data',
      'education',
      'infrastructure-transport',
      'security-governance',
      'technology-innovation',
      'environment-climate',
      'population',
      'business',
      'charts-explainers',
    ];

    // Build main sitemap XML
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://statsgh.com/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${categories.map(cat => `  <url>
    <loc>https://statsgh.com/${cat}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
${articles?.map(article => `  <url>
    <loc>https://statsgh.com/${article.category_slug}/${article.slug}</loc>
    <lastmod>${article.updated_at || article.published_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n') ?? ''}
</urlset>`;

    return new Response(sitemapXml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating main sitemap:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate main sitemap' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
