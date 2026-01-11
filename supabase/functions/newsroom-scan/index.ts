import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ghana business news sources
const NEWS_SOURCES = [
  { name: "Business & Financial Times", domain: "thebftonline.com" },
  { name: "Ghana Business News", domain: "ghanabusinessnews.com" },
  { name: "Graphic Business", domain: "graphic.com.gh" },
  { name: "Citi Newsroom Business", domain: "citinewsroom.com" },
  { name: "GhanaWeb Business", domain: "ghanaweb.com" },
  { name: "Modern Ghana Business", domain: "modernghana.com" },
  { name: "BusinessGhana", domain: "businessghana.com" },
  { name: "Business Day Ghana", domain: "businessdayghana.com" },
];

// Image styles to rotate through
const IMAGE_STYLES = [
  'investigative-collage',
  'ink-watercolour', 
  'newspaper-ink',
  'policy-illustration'
];

// Valid category slugs
const VALID_CATEGORIES = [
  "top-stories", "economy-inflation", "public-finance", "labour-salaries",
  "agriculture-food", "energy-resources", "trade-investment", "health-data",
  "education", "infrastructure-transport", "security-governance",
  "technology-innovation", "environment-climate", "population", "business",
  "charts-explainers"
];

const ARTICLE_SYSTEM_PROMPT = `You are the StatsGH automated newsroom system. Generate a complete news article from the provided source content.

WRITING RULES (apply to ALL fields):
- Do NOT use colons anywhere
- Do NOT use long dashes (—) anywhere  
- Do NOT use bullet points or lists
- Do NOT use emojis or hashtags
- Do NOT add links or URLs in any field
- Write all Ghana Cedi amounts as GHS only
- Write in the StatsGH tone: concise, data-driven, easy to grasp
- Prefer simple sentences and clear comparisons
- Keep it neutral and factual
- If key details are missing, state they are not yet confirmed

FIELD-SPECIFIC RULES:

1. headline: Short, factual, clear. No colon or long dash. Max 80 characters.

2. subtitle: Expands the headline in one sentence. No colon or long dash.

3. summary: Plain English, easy for anyone to understand. Maximum 400 characters.

4. body: Full article body with clean readable paragraphs. Write 4-8 paragraphs. Use HTML paragraph tags <p>. No bullet points.

5. seo_description: Plain English. Maximum 155 characters.

6. instagram_comment: ALWAYS exactly this text: "See full article link in bio."

7. twitter_post: Short, factual. No emojis or hashtags.

8. instagram_compressed: Short headline-style line plus one short line. MUST include "See full article link in bio." at the end.

9. slug: Lowercase words separated by hyphens. No special characters. No dates unless essential.

10. author: Always "StatsGH".

11. section: Choose the most appropriate category slug from: ${VALID_CATEGORIES.join(', ')}

12. tags: Short keywords from the article including places, institutions, indicators, and key figures. Array of strings.

RESPONSE FORMAT:
Return ONLY valid JSON with these exact keys:
{
  "headline": "string",
  "subtitle": "string",
  "summary": "string (max 400 chars)",
  "body": "string (HTML paragraphs)",
  "seo_description": "string (max 155 chars)",
  "instagram_comment": "See full article link in bio.",
  "twitter_post": "string",
  "instagram_compressed": "string",
  "slug": "string",
  "author": "StatsGH",
  "section": "category-slug",
  "tags": ["tag1", "tag2", "tag3"]
}`;

const IMAGE_PROMPTS: Record<string, string> = {
  'investigative-collage': 'Gritty split-frame investigative editorial collage, newspaper clippings, data overlays, Ghana business theme, no text, no logos, 16:9 aspect ratio, neutral serious tone, metaphor-driven',
  'ink-watercolour': 'Minimalist hand-drawn ink and watercolor illustration, Ghana business editorial, simple elegant lines, muted earth tones, no text, no logos, 16:9 aspect ratio, serious professional',
  'newspaper-ink': 'Classic newspaper editorial ink illustration, crosshatching technique, Ghana economy theme, vintage press style, no text, no logos, 16:9 aspect ratio, dignified factual',
  'policy-illustration': 'Clean conceptual policy illustration, abstract geometric shapes, Ghana finance and governance theme, professional minimal, no text, no logos, 16:9 aspect ratio, neutral analytical'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { triggerType = 'manual', userId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create a new run record
    const { data: run, error: runError } = await supabase
      .from('newsroom_runs')
      .insert({
        trigger_type: triggerType,
        status: 'running',
        created_by: userId || null
      })
      .select()
      .single();

    if (runError) {
      console.error('Failed to create run:', runError);
      return new Response(
        JSON.stringify({ error: 'Failed to create newsroom run' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Started newsroom run: ${run.id}`);

    // Search for Ghana business news from all sources
    const searchQuery = NEWS_SOURCES.map(s => `site:${s.domain}`).join(' OR ') + ' Ghana business news';
    
    // Use Lovable AI to search for recent news
    const searchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: `You are a news aggregator. Search for the latest Ghana business news from these sources: ${NEWS_SOURCES.map(s => s.name).join(', ')}. 
            
Only include articles published within the last 5 hours. For each article found, extract:
- source_name: The publication name
- headline: The article headline
- summary: A brief summary (2-3 sentences)
- published_time: Approximate publication time

If no articles were published in the last 5 hours, return an empty array.

Return ONLY valid JSON array:
[
  {
    "source_name": "string",
    "headline": "string", 
    "summary": "string",
    "published_time": "ISO timestamp or relative time"
  }
]`
          },
          { 
            role: 'user', 
            content: `Find the latest Ghana business news published in the last 5 hours. Today's date is ${new Date().toISOString().split('T')[0]}. Current time is ${new Date().toISOString()}.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for recent news articles",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" }
              },
              required: ["query"]
            }
          }
        }]
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Search failed:', searchResponse.status, errorText);
      
      await supabase
        .from('newsroom_runs')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          error_message: `Search failed: ${searchResponse.status}`
        })
        .eq('id', run.id);

      if (searchResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (searchResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to search for news' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    const searchContent = searchData.choices?.[0]?.message?.content || '[]';
    
    let newsItems: Array<{source_name: string; headline: string; summary: string; published_time: string}> = [];
    try {
      const jsonMatch = searchContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        newsItems = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse news items:', e);
    }

    console.log(`Found ${newsItems.length} news items`);

    if (newsItems.length === 0) {
      await supabase
        .from('newsroom_runs')
        .update({ 
          status: 'no_news', 
          completed_at: new Date().toISOString(),
          articles_found: 0,
          articles_created: 0
        })
        .eq('id', run.id);

      return new Response(
        JSON.stringify({ 
          message: 'No qualifying Ghana business news published in the last 5 hours.',
          run_id: run.id,
          articles_created: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update run with articles found
    await supabase
      .from('newsroom_runs')
      .update({ articles_found: newsItems.length })
      .eq('id', run.id);

    // Process each news item
    let articlesCreated = 0;
    let imageStyleIndex = 0;

    for (const newsItem of newsItems) {
      try {
        // Check for duplicates based on headline similarity
        const { data: existing } = await supabase
          .from('newsroom_articles')
          .select('id')
          .ilike('original_headline', `%${newsItem.headline.substring(0, 50)}%`)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`Skipping duplicate: ${newsItem.headline}`);
          
          await supabase
            .from('newsroom_articles')
            .insert({
              run_id: run.id,
              source_name: newsItem.source_name,
              original_headline: newsItem.headline,
              original_summary: newsItem.summary,
              processing_status: 'duplicate'
            });
          continue;
        }

        // Create newsroom article record
        const currentImageStyle = IMAGE_STYLES[imageStyleIndex % IMAGE_STYLES.length];
        imageStyleIndex++;

        const { data: newsroomArticle, error: insertError } = await supabase
          .from('newsroom_articles')
          .insert({
            run_id: run.id,
            source_name: newsItem.source_name,
            original_headline: newsItem.headline,
            original_summary: newsItem.summary,
            processing_status: 'processing',
            image_style: currentImageStyle
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert newsroom article:', insertError);
          continue;
        }

        // Generate full article using AI
        const articleResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
              { 
                role: 'user', 
                content: `Generate a complete StatsGH article from this source news:

Source: ${newsItem.source_name}
Headline: ${newsItem.headline}
Summary: ${newsItem.summary}
Published: ${newsItem.published_time}`
              }
            ],
          }),
        });

        if (!articleResponse.ok) {
          console.error('Article generation failed:', articleResponse.status);
          await supabase
            .from('newsroom_articles')
            .update({ 
              processing_status: 'failed',
              error_message: `Generation failed: ${articleResponse.status}`
            })
            .eq('id', newsroomArticle.id);
          continue;
        }

        const articleData = await articleResponse.json();
        const articleContent = articleData.choices?.[0]?.message?.content;

        if (!articleContent) {
          await supabase
            .from('newsroom_articles')
            .update({ 
              processing_status: 'failed',
              error_message: 'No content generated'
            })
            .eq('id', newsroomArticle.id);
          continue;
        }

        // Parse the generated article
        let generatedArticle;
        try {
          const jsonMatch = articleContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found');
          generatedArticle = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse article:', e);
          await supabase
            .from('newsroom_articles')
            .update({ 
              processing_status: 'failed',
              error_message: 'Failed to parse generated article'
            })
            .eq('id', newsroomArticle.id);
          continue;
        }

        // Validate and sanitize
        if (!VALID_CATEGORIES.includes(generatedArticle.section)) {
          generatedArticle.section = 'business';
        }
        generatedArticle.instagram_comment = 'See full article link in bio.';
        if (generatedArticle.summary?.length > 400) {
          generatedArticle.summary = generatedArticle.summary.substring(0, 397) + '...';
        }
        if (generatedArticle.seo_description?.length > 155) {
          generatedArticle.seo_description = generatedArticle.seo_description.substring(0, 152) + '...';
        }

        // Ensure unique slug
        let slug = generatedArticle.slug || generatedArticle.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data: existingSlug } = await supabase
          .from('articles')
          .select('id')
          .eq('slug', slug)
          .limit(1);
        
        if (existingSlug && existingSlug.length > 0) {
          slug = `${slug}-${Date.now()}`;
        }

        // Insert the article as draft
        const { data: article, error: articleError } = await supabase
          .from('articles')
          .insert({
            title: generatedArticle.headline,
            subtitle: generatedArticle.subtitle,
            summary: generatedArticle.summary,
            body: generatedArticle.body,
            slug: slug,
            author_name: 'StatsGH',
            section: generatedArticle.section,
            category_slug: generatedArticle.section,
            seo_description: generatedArticle.seo_description,
            twitter_post: generatedArticle.twitter_post,
            instagram_comment: generatedArticle.instagram_comment,
            instagram_compressed: generatedArticle.instagram_compressed,
            tags: Array.isArray(generatedArticle.tags) ? generatedArticle.tags : [],
            is_published: false,
            status: 'draft'
          })
          .select()
          .single();

        if (articleError) {
          console.error('Failed to insert article:', articleError);
          await supabase
            .from('newsroom_articles')
            .update({ 
              processing_status: 'failed',
              error_message: articleError.message
            })
            .eq('id', newsroomArticle.id);
          continue;
        }

        // Update newsroom article with success
        await supabase
          .from('newsroom_articles')
          .update({ 
            processing_status: 'completed',
            generated_article_id: article.id
          })
          .eq('id', newsroomArticle.id);

        articlesCreated++;
        console.log(`Created article: ${article.title}`);

      } catch (itemError) {
        console.error('Error processing news item:', itemError);
      }
    }

    // Update run as completed
    await supabase
      .from('newsroom_runs')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        articles_created: articlesCreated
      })
      .eq('id', run.id);

    return new Response(
      JSON.stringify({ 
        message: `Newsroom scan complete. Created ${articlesCreated} draft articles.`,
        run_id: run.id,
        articles_found: newsItems.length,
        articles_created: articlesCreated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Newsroom scan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
