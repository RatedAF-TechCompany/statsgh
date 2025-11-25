import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    
    if (!slug) {
      return new Response('Missing slug parameter', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch article data
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error || !article) {
      return new Response('Article not found', { status: 404 });
    }

    // Prepare absolute URLs
    const baseUrl = 'https://statsgh.com';
    const articleUrl = `${baseUrl}/article/${article.slug}`;
    let imageUrl = article.hero_image_url || `${baseUrl}/social/statsgh-og-1200x630.png`;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    const description = article.summary || article.subtitle || 'Latest Ghana news from StatsGH';

    // Generate HTML with meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="${baseUrl}/favicon.png" type="image/png" />
  <title>${article.title} | StatsGH</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${articleUrl}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${articleUrl}" />
  <meta property="og:title" content="${article.title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:site_name" content="StatsGH" />
  <meta property="article:published_time" content="${article.published_at}" />
  <meta property="article:modified_time" content="${article.updated_at || article.published_at}" />
  <meta property="article:author" content="${article.author_name}" />
  
  ${article.video_url ? `
  <meta property="og:video" content="${article.video_url.startsWith('http') ? article.video_url : baseUrl + article.video_url}" />
  <meta property="og:video:secure_url" content="${article.video_url.startsWith('http') ? article.video_url : baseUrl + article.video_url}" />
  <meta property="og:video:type" content="text/html" />
  ` : ''}
  
  ${article.audio_url ? `
  <meta property="og:audio" content="${article.audio_url.startsWith('http') ? article.audio_url : baseUrl + article.audio_url}" />
  <meta property="og:audio:secure_url" content="${article.audio_url.startsWith('http') ? article.audio_url : baseUrl + article.audio_url}" />
  <meta property="og:audio:type" content="audio/mpeg" />
  ` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="${article.video_url ? 'player' : 'summary_large_image'}" />
  <meta name="twitter:site" content="@StatsGH" />
  <meta name="twitter:title" content="${article.title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  ${article.video_url ? `
  <meta name="twitter:player" content="${article.video_url.startsWith('http') ? article.video_url : baseUrl + article.video_url}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />
  ` : ''}
  
  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${articleUrl}"
    },
    "headline": "${article.title}",
    "description": "${description}",
    "image": ["${imageUrl}"],
    "datePublished": "${article.published_at}",
    "dateModified": "${article.updated_at || article.published_at}",
    "author": {
      "@type": "Organization",
      "name": "StatsGH"
    },
    "publisher": {
      "@type": "Organization",
      "name": "StatsGH",
      "url": "${baseUrl}",
      "logo": {
        "@type": "ImageObject",
        "url": "${baseUrl}/social/statsgh-og-1200x630.png"
      }
    },
    "isAccessibleForFree": "true"
  }
  </script>
  
  <!-- Redirect to actual page -->
  <meta http-equiv="refresh" content="0;url=${articleUrl}" />
</head>
<body>
  <p>Redirecting to article...</p>
  <script>window.location.href = "${articleUrl}";</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
