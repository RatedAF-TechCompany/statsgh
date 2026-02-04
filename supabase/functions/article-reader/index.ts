import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected path: /article-reader?slug=xxx or /article-reader/category/slug
    let slug = url.searchParams.get('slug');
    
    if (!slug && pathParts.length >= 2) {
      slug = pathParts[pathParts.length - 1];
    }
    
    if (!slug) {
      return new Response('Missing slug parameter', { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
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
      return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Not Found | StatsGH</title>
</head>
<body>
  <main>
    <h1>Article Not Found</h1>
    <p>The requested article could not be found.</p>
  </main>
</body>
</html>`, {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    const baseUrl = 'https://statsgh.com';
    const articleUrl = `${baseUrl}/${article.category_slug}/${article.slug}`;
    const canonicalUrl = articleUrl;
    
    let imageUrl = article.hero_image_url || `${baseUrl}/social/statsgh-og-1200x630.png`;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    const description = article.summary || article.subtitle || 'Latest Ghana news from StatsGH';
    const publishedDate = article.published_at ? new Date(article.published_at).toISOString() : '';
    const formattedDate = article.published_at 
      ? new Date(article.published_at).toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : '';
    
    const formattedCategory = article.category_slug?.replace(/-/g, ' ') || '';
    const tags = article.tags || [];

    // Clean body HTML for display - keep safe tags only
    const bodyHtml = article.body || '';

    // Generate plain HTML reader page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.title)} | StatsGH</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" href="${baseUrl}/favicon.png" type="image/png">
  
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:title" content="${escapeHtml(article.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="StatsGH">
  <meta property="article:published_time" content="${publishedDate}">
  <meta property="article:author" content="${escapeHtml(article.author_name)}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@StatsGH">
  <meta name="twitter:title" content="${escapeHtml(article.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: Georgia, 'Times New Roman', serif; 
      line-height: 1.7; 
      max-width: 720px; 
      margin: 0 auto; 
      padding: 24px 16px;
      color: #1a1a1a;
      background: #fff;
    }
    header { margin-bottom: 32px; border-bottom: 1px solid #e5e5e5; padding-bottom: 16px; }
    .logo { font-weight: bold; font-size: 1.5rem; color: #8b0000; text-decoration: none; }
    main { margin-bottom: 48px; }
    article { }
    .category { 
      text-transform: uppercase; 
      font-size: 0.75rem; 
      font-weight: bold; 
      letter-spacing: 0.1em; 
      color: #8b0000; 
      margin-bottom: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    h1 { 
      font-size: 2rem; 
      line-height: 1.2; 
      margin-bottom: 16px; 
      font-weight: 600;
    }
    .summary { 
      font-size: 1.125rem; 
      color: #444; 
      margin-bottom: 20px;
      font-style: italic;
    }
    .meta { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.875rem; 
      color: #666; 
      margin-bottom: 24px;
      border-top: 1px solid #e5e5e5;
      border-bottom: 1px solid #e5e5e5;
      padding: 12px 0;
    }
    .meta time { }
    .meta .author { font-weight: 500; color: #1a1a1a; }
    .hero-image { width: 100%; max-width: 100%; height: auto; margin-bottom: 24px; }
    section[data-article-body="true"] { }
    section[data-article-body="true"] p { margin-bottom: 1.25em; }
    section[data-article-body="true"] h2, 
    section[data-article-body="true"] h3 { margin: 1.5em 0 0.75em; font-weight: 600; }
    section[data-article-body="true"] ul, 
    section[data-article-body="true"] ol { margin: 1em 0; padding-left: 1.5em; }
    section[data-article-body="true"] li { margin-bottom: 0.5em; }
    section[data-article-body="true"] blockquote { 
      border-left: 3px solid #8b0000; 
      padding-left: 1em; 
      margin: 1.5em 0; 
      font-style: italic; 
      color: #444;
    }
    section[data-article-body="true"] a { color: #8b0000; }
    .tags { 
      margin-top: 32px; 
      padding-top: 16px; 
      border-top: 1px solid #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.875rem;
    }
    .tags span { 
      display: inline-block; 
      background: #f5f5f5; 
      padding: 4px 12px; 
      margin: 4px 4px 4px 0; 
      border-radius: 4px;
    }
    .source-line { 
      margin-top: 24px; 
      font-size: 0.875rem; 
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    footer { 
      border-top: 1px solid #e5e5e5; 
      padding-top: 24px; 
      font-size: 0.875rem; 
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    footer a { color: #8b0000; }
  </style>
  
  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${articleUrl}"
    },
    "headline": "${escapeHtml(article.title).replace(/"/g, '\\\\"')}",
    "description": "${escapeHtml(description).replace(/"/g, '\\\\"')}",
    "image": ["${imageUrl}"],
    "datePublished": "${publishedDate}",
    "dateModified": "${article.updated_at || publishedDate}",
    "author": {
      "@type": "Person",
      "name": "${escapeHtml(article.author_name)}"
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
</head>
<body>
  <header>
    <a href="${baseUrl}" class="logo">StatsGH</a>
  </header>
  
  <main>
    <article>
      <div class="category">${escapeHtml(formattedCategory)}</div>
      
      <h1>${escapeHtml(article.title)}</h1>
      
      ${article.summary ? `<p class="summary">${escapeHtml(article.summary)}</p>` : ''}
      
      <div class="meta">
        <span class="author">${escapeHtml(article.author_name)}</span>
        ${formattedDate ? ` · <time datetime="${publishedDate}">${formattedDate}</time>` : ''}
      </div>
      
      ${article.hero_image_url ? `<img src="${imageUrl}" alt="${escapeHtml(article.title)}" class="hero-image">` : ''}
      
      <section data-article-body="true">
        ${bodyHtml}
      </section>
      
      ${tags.length > 0 ? `
      <div class="tags">
        <strong>Tags:</strong> ${tags.map((t: string) => `<span>${escapeHtml(t)}</span>`).join(' ')}
      </div>
      ` : ''}
      
      <p class="source-line">
        Source: <a href="${baseUrl}">StatsGH</a> — Ghana's data-driven news platform
      </p>
    </article>
  </main>
  
  <footer>
    <p>© StatsGH. <a href="${articleUrl}">View full article</a></p>
  </footer>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error | StatsGH</title>
</head>
<body>
  <main>
    <h1>Error</h1>
    <p>An error occurred while loading the article.</p>
  </main>
</body>
</html>`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});
