import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remove accidental duplicated words/phrases like "not not" or "not. not".
// Keeps punctuation, but collapses immediate repeated tokens (case-insensitive).
function collapseImmediateWordRepeats(input: string): string {
  if (!input) return input;

  let s = String(input);
  s = s.replace(/\s+/g, " ").trim();

  // Collapse repeats even when separated by punctuation/spaces (e.g., "not. not", "the, the").
  // We apply twice to handle triple repeats.
  for (let i = 0; i < 2; i++) {
    s = s.replace(/\b([a-zA-Z]+)\b([\s.,;:!?]+\1\b)+/gi, "$1");
    s = s.replace(/\s+/g, " ").trim();
  }

  return s;
}

// Valid category slugs for StatsGH
const VALID_CATEGORIES = [
  "macroeconomy",
  "markets",
  "public-finance",
  "banking-and-finance",
  "energy-and-utilities",
  "trade-and-industry",
  "corporate-ghana",
  "agriculture-and-commodities",
  "infrastructure-and-transport",
  "data-and-research",
  "regulation-and-policy",
  "technology-and-digital-economy",
  "labour-and-jobs",
  "regional-economy",
];

const CATEGORY_LABELS: Record<string, string> = {
  "macroeconomy": "Macroeconomy",
  "markets": "Markets",
  "public-finance": "Public Finance",
  "banking-and-finance": "Banking and Finance",
  "energy-and-utilities": "Energy and Utilities",
  "trade-and-industry": "Trade and Industry",
  "corporate-ghana": "Corporate Ghana",
  "agriculture-and-commodities": "Agriculture and Commodities",
  "infrastructure-and-transport": "Infrastructure and Transport",
  "data-and-research": "Data and Research",
  "regulation-and-policy": "Regulation and Policy",
  "technology-and-digital-economy": "Technology and Digital Economy",
  "labour-and-jobs": "Labour and Jobs",
  "regional-economy": "Regional Economy",
};

const systemPrompt = `You are a professional news editor for StatsGH, a data-driven news platform focused on Ghana.

Your task is to generate article metadata from article body text. Follow these rules strictly:

WRITING RULES (apply to ALL fields):
- Do NOT use colons anywhere
- Do NOT use long dashes (—) anywhere
- Do NOT use bullet points or lists
- Do NOT use emojis or hashtags
- Do NOT add links or URLs in any field
- Write in the StatsGH tone: concise, data-driven, easy to grasp
- Prefer simple sentences and clear comparisons
- Keep it neutral and factual
- If key details are missing, state they are not yet confirmed

FIELD-SPECIFIC RULES:

1. headline: Short, factual, clear. No colon or long dash.

2. subtitle: Expands the headline in one sentence. No colon or long dash.

3. summary: Plain English, easy for anyone to understand. Maximum 400 characters.

4. seo_description: Plain English. Maximum 155 characters.

5. instagram_comment: ALWAYS exactly this text: "See full article link in bio."

6. twitter_post: Short, factual. No emojis or hashtags.

7. instagram_compressed: Short headline-style line plus one short line. MUST include "See full article link in bio." at the end.

8. slug: Lowercase words separated by hyphens. No special characters. No dates unless essential.

9. author: Default to "StatsGH" unless the article mentions a specific author.

10. section: Choose the most appropriate category slug from this list:
${VALID_CATEGORIES.map(c => `- ${c} (${CATEGORY_LABELS[c]})`).join('\n')}

11. tags: Short keywords from the article including places, institutions, indicators, and key figures. Provide as comma-separated string.

RESPONSE FORMAT:
Return ONLY valid JSON with these exact keys:
{
  "headline": "string",
  "subtitle": "string", 
  "summary": "string (max 400 chars)",
  "seo_description": "string (max 155 chars)",
  "instagram_comment": "See full article link in bio.",
  "twitter_post": "string",
  "instagram_compressed": "string",
  "slug": "string",
  "author": "string",
  "section": "category-slug",
  "tags": "tag1, tag2, tag3"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleBody, removeUrls } = await req.json();
    
    if (!articleBody || articleBody.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Article body is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean article body if removeUrls is true (user submitted a dot)
    let cleanedBody = articleBody;
    if (removeUrls) {
      cleanedBody = articleBody.replace(/https?:\/\/[^\s]+/g, '').replace(/www\.[^\s]+/g, '');
    }

    const userPrompt = `Generate all article metadata fields from this article body:\n\n${cleanedBody}`;

    console.log('Calling Lovable AI for article generation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate article fields' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received:', content.substring(0, 200));

    // Parse the JSON response from AI
    let generatedFields;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      generatedFields = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize the section field
    if (!VALID_CATEGORIES.includes(generatedFields.section)) {
      generatedFields.section = 'macroeconomy'; // Default fallback
    }

    // Guardrail: collapse accidental repeated words (e.g., "not not") across generated copy.
    const keysToClean = [
      'headline',
      'subtitle',
      'summary',
      'seo_description',
      'twitter_post',
      'instagram_compressed',
      'slug',
      'author',
      'section',
      'tags',
    ];
    for (const k of keysToClean) {
      if (typeof generatedFields?.[k] === 'string') {
        generatedFields[k] = collapseImmediateWordRepeats(generatedFields[k]);
      }
    }

    // Ensure instagram_comment is correct
    generatedFields.instagram_comment = 'See full article link in bio.';

    // Ensure summary doesn't exceed 400 chars
    if (generatedFields.summary && generatedFields.summary.length > 400) {
      generatedFields.summary = generatedFields.summary.substring(0, 397) + '...';
    }

    // Ensure seo_description doesn't exceed 155 chars
    if (generatedFields.seo_description && generatedFields.seo_description.length > 155) {
      generatedFields.seo_description = generatedFields.seo_description.substring(0, 152) + '...';
    }

    console.log('Successfully generated article fields');

    return new Response(
      JSON.stringify(generatedFields),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-article-fields:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
