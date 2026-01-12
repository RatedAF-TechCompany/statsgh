import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import OpenAI from "https://esm.sh/openai@4.20.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

13. image_prompt: A short, specific description for generating an editorial illustration. Focus on the key visual metaphor that represents the story. Max 50 words.

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
  "tags": ["tag1", "tag2", "tag3"],
  "image_prompt": "string (visual metaphor for the story)"
}`;

const IMAGE_STYLE_PROMPTS: Record<string, string> = {
  'investigative-collage': 'Gritty split-frame investigative editorial collage style, newspaper clippings aesthetic, data overlays, Ghana Africa theme, no text no words no letters, no logos, 16:9 wide aspect ratio, neutral serious tone, metaphor-driven visual',
  'ink-watercolour': 'Minimalist hand-drawn ink and watercolor illustration style, editorial art, simple elegant flowing lines, muted earth tones and ochre, no text no words no letters, no logos, 16:9 wide aspect ratio, serious professional mood',
  'newspaper-ink': 'Classic newspaper editorial ink illustration style, detailed crosshatching technique, vintage press aesthetic, no text no words no letters, no logos, 16:9 wide aspect ratio, dignified factual tone',
  'policy-illustration': 'Clean conceptual policy illustration style, abstract geometric shapes, professional minimal design, no text no words no letters, no logos, 16:9 wide aspect ratio, neutral analytical mood'
};

// Generate editorial image using OpenAI DALL-E 3
async function generateEditorialImage(
  headline: string,
  imagePrompt: string,
  imageStyle: string,
  openai: OpenAI
): Promise<string | null> {
  try {
    const stylePrompt = IMAGE_STYLE_PROMPTS[imageStyle] || IMAGE_STYLE_PROMPTS['policy-illustration'];
    const fullPrompt = `${stylePrompt}. Subject: ${imagePrompt}. Context: ${headline}`;

    console.log(`Generating image with DALL-E 3, style: ${imageStyle}`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      style: "vivid",
      response_format: "b64_json"
    });

    const base64Data = response.data?.[0]?.b64_json;
    if (!base64Data) {
      console.error('No image data in response');
      return null;
    }

    return `data:image/png;base64,${base64Data}`;
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
}

// Upload base64 image to Supabase storage
async function uploadImageToStorage(
  supabase: any,
  base64Data: string,
  articleSlug: string
): Promise<string | null> {
  try {
    // Extract base64 content (remove data:image/png;base64, prefix)
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = decode(base64Content);

    const fileName = `newsroom/${articleSlug}-${Date.now()}.png`;

    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { triggerType = 'manual', userId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
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

    // Search for Ghana business news using GPT-4o with web browsing
    const searchResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: 'system', 
          content: `You are a news aggregator. Find the latest Ghana business news from these sources: ${NEWS_SOURCES.map(s => s.name).join(', ')}. 

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
      max_tokens: 4000
    });

    const searchContent = searchResponse.choices?.[0]?.message?.content || '[]';
    
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
        // Check for duplicates in newsroom_articles (same headline from any source)
        const headlineKeywords = newsItem.headline.substring(0, 50);
        const { data: existingNewsroom } = await supabase
          .from('newsroom_articles')
          .select('id')
          .ilike('original_headline', `%${headlineKeywords}%`)
          .limit(1);

        if (existingNewsroom && existingNewsroom.length > 0) {
          console.log(`Skipping duplicate (newsroom): ${newsItem.headline}`);
          
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

        // Also check published articles for similar content (different sources covering same story)
        // Extract key terms from headline for broader matching
        const keyTerms = newsItem.headline
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(' ')
          .filter(word => word.length > 4)
          .slice(0, 3);
        
        let isDuplicateContent = false;
        for (const term of keyTerms) {
          const { data: existingArticles } = await supabase
            .from('articles')
            .select('id, title')
            .ilike('title', `%${term}%`)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
            .limit(5);
          
          if (existingArticles && existingArticles.length > 0) {
            // Check if any existing article covers similar topic
            for (const existingArt of existingArticles) {
              const existingTerms = existingArt.title
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(' ')
                .filter((w: string) => w.length > 4);
              
              const matchCount = keyTerms.filter(t => existingTerms.includes(t)).length;
              if (matchCount >= 2) {
                isDuplicateContent = true;
                console.log(`Skipping similar content: "${newsItem.headline}" matches "${existingArt.title}"`);
                break;
              }
            }
          }
          if (isDuplicateContent) break;
        }

        if (isDuplicateContent) {
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

        // Generate full article using OpenAI
        const articleResponse = await openai.chat.completions.create({
          model: "gpt-4o",
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
          max_tokens: 4000
        });

        const articleContent = articleResponse.choices?.[0]?.message?.content;

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

        // Generate editorial image with DALL-E 3
        let heroImageUrl: string | null = null;
        const imagePrompt = generatedArticle.image_prompt || generatedArticle.headline;
        
        console.log(`Generating editorial image for: ${slug}`);
        const base64Image = await generateEditorialImage(
          generatedArticle.headline,
          imagePrompt,
          currentImageStyle,
          openai
        );

        if (base64Image) {
          heroImageUrl = await uploadImageToStorage(supabase, base64Image, slug);
          if (heroImageUrl) {
            console.log(`Image uploaded: ${heroImageUrl}`);
          }
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
            hero_image_url: heroImageUrl,
            is_published: true,
            status: 'published'
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
        console.log(`Created article with image: ${article.title}`);

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

    // Send email notification to admins if articles were created
    if (articlesCreated > 0) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        try {
          const resend = new Resend(RESEND_API_KEY);
          
          // Get admin emails from user_roles
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['admin', 'editor']);
          
          if (adminRoles && adminRoles.length > 0) {
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('email')
              .in('id', adminRoles.map(r => r.user_id));
            
            const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
            
            if (adminEmails.length > 0) {
              const siteUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '') || 'https://statsgh.com';
              
              await resend.emails.send({
                from: 'StatsGH Newsroom <noreply@statsgh.com>',
                to: adminEmails,
                subject: `📰 ${articlesCreated} New Article${articlesCreated > 1 ? 's' : ''} Auto-Published`,
                html: `
                  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a1a1a;">StatsGH Automated Newsroom</h2>
                    <p style="color: #333; font-size: 16px;">
                      The newsroom system has automatically published <strong>${articlesCreated} new article${articlesCreated > 1 ? 's' : ''}</strong>.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                      Trigger: ${triggerType === 'scheduled' ? 'Scheduled scan' : 'Manual scan'}<br>
                      Sources scanned: ${newsItems.length}<br>
                      Run ID: ${run.id}
                    </p>
                    <a href="https://statsgh.com/admin/newsroom" 
                       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
                      View in Newsroom Dashboard
                    </a>
                    <p style="color: #999; font-size: 12px; margin-top: 24px;">
                      This is an automated notification from StatsGH Newsroom.
                    </p>
                  </div>
                `,
              });
              console.log(`Notification email sent to ${adminEmails.length} admin(s)`);
            }
          }
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Newsroom scan complete. Published ${articlesCreated} articles.`,
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
