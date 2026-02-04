import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the URL like a basic crawler (no JS execution)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StatsGH-CrawlerTest/1.0 (like Googlebot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const status = response.status;
    const html = await response.text();
    const htmlLength = html.length;

    // Extract headline (h1)
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const headline = h1Match ? h1Match[1].trim() : null;

    // Extract article body content
    const bodyMatch = html.match(/<section[^>]*data-article-body="true"[^>]*>([\s\S]*?)<\/section>/i);
    let bodyText = '';
    if (bodyMatch) {
      // Strip HTML tags from body content
      bodyText = bodyMatch[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Alternative: look for article body in prose class
    if (!bodyText) {
      const proseMatch = html.match(/<div[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (proseMatch) {
        bodyText = proseMatch[1]
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    // Check for main content area
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const hasMain = !!mainMatch;

    // Check for article tag
    const articleMatch = html.match(/<article[^>]*>/i);
    const hasArticle = !!articleMatch;

    // Check for time/date element
    const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
    const dateFound = timeMatch ? timeMatch[1] : null;

    // Check for canonical link
    const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*/i);
    const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;

    // Check for og:title
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"[^>]*/i);
    const ogTitle = ogTitleMatch ? ogTitleMatch[1] : null;

    // Check for meta description
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1] : null;

    // Determine pass/fail
    const hasHeadline = !!headline && headline.length > 0;
    const hasBody = bodyText.length >= 300;
    const passed = hasHeadline && hasBody;

    const result = {
      url,
      status,
      htmlLength,
      passed,
      checks: {
        headline: {
          found: hasHeadline,
          value: headline ? headline.substring(0, 100) : null,
        },
        body: {
          found: hasBody,
          length: bodyText.length,
          preview: bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : ''),
        },
        semanticHtml: {
          hasMain,
          hasArticle,
          hasTimeElement: !!dateFound,
          dateValue: dateFound,
        },
        seo: {
          canonicalUrl,
          ogTitle,
          metaDescription: metaDescription ? metaDescription.substring(0, 100) : null,
        },
      },
      summary: passed 
        ? '✅ PASS: Headline and body (300+ chars) found in HTML' 
        : `❌ FAIL: ${!hasHeadline ? 'No headline found. ' : ''}${!hasBody ? `Body too short (${bodyText.length} chars, need 300+)` : ''}`,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
