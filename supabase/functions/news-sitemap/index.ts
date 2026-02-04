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

    // Get articles from last 72 hours
    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('slug, category_slug, title, published_at, updated_at')
      .eq('is_published', true)
      .gte('published_at', seventyTwoHoursAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }

    const edgeFunctionBase = Deno.env.get('SUPABASE_URL') + '/functions/v1/article-reader';
    
    // Build Google News sitemap XML with xhtml:link for machine-readable alternate
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${articles?.map(article => `  <url>
    <loc>https://statsgh.com/${article.category_slug}/${article.slug}</loc>
    <xhtml:link rel="alternate" type="text/html" href="${edgeFunctionBase}?slug=${article.slug}" />
    <news:news>
      <news:publication>
        <news:name>StatsGH</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${article.published_at}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
    </news:news>
    <lastmod>${article.updated_at}</lastmod>
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
    console.error('Error generating news sitemap:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate news sitemap' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
