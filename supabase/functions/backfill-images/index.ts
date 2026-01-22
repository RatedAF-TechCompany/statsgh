import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Stock photo keywords by category
const CATEGORY_PHOTO_KEYWORDS: Record<string, string[]> = {
  "economy-inflation": ["africa,money", "ghana,market", "africa,currency", "africa,shopping"],
  "public-finance": ["africa,government,building", "africa,parliament", "ghana,office", "africa,meeting"],
  "labour-salaries": ["africa,workers", "ghana,office", "africa,factory", "africa,employees"],
  "agriculture-food": ["ghana,farming", "africa,agriculture", "africa,market,food", "ghana,crops"],
  "energy-resources": ["africa,energy", "ghana,power", "africa,oil", "africa,solar"],
  "trade-investment": ["africa,port", "ghana,shipping", "africa,business", "africa,trade"],
  "health-data": ["africa,hospital", "ghana,healthcare", "africa,medical", "africa,clinic"],
  "education": ["africa,school", "ghana,classroom", "africa,students", "africa,university"],
  "infrastructure-transport": ["ghana,road", "africa,construction", "africa,bridge", "ghana,transport"],
  "security-governance": ["africa,government", "ghana,police", "africa,security", "africa,parliament"],
  "technology-innovation": ["africa,technology", "ghana,computer", "africa,startup", "africa,mobile"],
  "environment-climate": ["ghana,nature", "africa,environment", "africa,climate", "africa,forest"],
  "population": ["ghana,city", "africa,people", "africa,urban", "ghana,community"],
  "business": ["africa,business", "ghana,office", "africa,entrepreneur", "africa,meeting"],
  "top-stories": ["ghana,city", "africa,news", "ghana,accra", "africa,people"],
  "charts-explainers": ["africa,data", "africa,office", "africa,computer", "africa,meeting"],
};

const DEFAULT_PHOTO_KEYWORDS = ["ghana", "africa,business", "africa,city", "africa,people"];

function getPhotoKeywords(category: string): string {
  const keywords = CATEGORY_PHOTO_KEYWORDS[category] || DEFAULT_PHOTO_KEYWORDS;
  return keywords[Math.floor(Math.random() * keywords.length)];
}

// Generate AI image using Lovable AI (Gemini)
async function generateAiImage(
  prompt: string,
  supabase: any,
  articleSlug: string
): Promise<string | null> {
  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.log('LOVABLE_API_KEY not configured, skipping AI image');
      return null;
    }
    
    console.log(`Generating AI image for: ${articleSlug}`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: `Generate a photorealistic, professional editorial photograph for a news article. 
Style: Documentary journalism, high quality, 16:9 aspect ratio, professional lighting.
Subject: ${prompt}
Requirements: No text, no logos, no watermarks, no faces that look AI-generated. 
The image should look like it was taken by a professional photojournalist in Ghana or Africa.`
          }
        ],
        modalities: ['image', 'text']
      })
    });
    
    if (!response.ok) {
      console.log(`AI image generation failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData || !imageData.startsWith('data:image')) {
      console.log('No valid image in AI response');
      return null;
    }
    
    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.log('Could not parse AI image data');
      return null;
    }
    
    const [, format, base64Data] = base64Match;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const ext = format === 'png' ? 'png' : 'jpg';
    const contentType = `image/${format === 'png' ? 'png' : 'jpeg'}`;
    const imagePath = `newsroom/${articleSlug}-ai.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { contentType, upsert: true });
    
    if (uploadError) {
      console.error('AI image upload error:', uploadError);
      return null;
    }
    
    const { data: publicUrl } = supabase.storage
      .from('media')
      .getPublicUrl(imagePath);
    
    console.log(`AI image generated and uploaded: ${publicUrl.publicUrl}`);
    return publicUrl.publicUrl;
  } catch (error) {
    console.log(`AI image error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 10);

    // Find articles without images
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, slug, section, category_slug")
      .is("hero_image_url", null)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    console.log(`Found ${articles?.length || 0} articles without images`);

    let updated = 0;
    const results: Array<{ id: string; title: string; image_url: string | null; source: string }> = [];

    for (const article of articles || []) {
      console.log(`Processing: ${article.title}`);
      
      let heroImageUrl: string | null = null;
      let imageSource = "none";

      // Generate AI image directly (Unsplash Source API is deprecated)
      console.log(`Generating AI image for: ${article.slug}`);
      
      const imagePrompt = `Professional editorial photograph: ${article.title}. African business context, Ghana, documentary style.`;
      heroImageUrl = await generateAiImage(imagePrompt, supabase, article.slug);
      
      if (heroImageUrl) {
        imageSource = "ai-generated";
      }

      // Update article with image
      if (heroImageUrl) {
        const { error: updateError } = await supabase
          .from("articles")
          .update({ hero_image_url: heroImageUrl })
          .eq("id", article.id);

        if (!updateError) {
          updated++;
          console.log(`✓ Updated article: ${article.title}`);
        } else {
          console.error(`Update error for ${article.id}:`, updateError);
        }
      }

      results.push({
        id: article.id,
        title: article.title,
        image_url: heroImageUrl,
        source: imageSource,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return new Response(
      JSON.stringify({
        success: true,
        articles_processed: articles?.length || 0,
        articles_updated: updated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
