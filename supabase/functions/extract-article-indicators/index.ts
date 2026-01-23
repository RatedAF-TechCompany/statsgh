import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedDataPoint {
  indicator_slug: string;
  indicator_name: string;
  value: number;
  date: string;
  unit: string;
  confidence: number;
  context: string;
}

interface ExtractionResult {
  data_points: ExtractedDataPoint[];
}

// Strip HTML tags from content
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { article_id } = await req.json();

    if (!article_id) {
      return new Response(
        JSON.stringify({ success: false, error: "article_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("id, title, body, published_at")
      .eq("id", article_id)
      .single();

    if (articleError || !article) {
      return new Response(
        JSON.stringify({ success: false, error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch available indicators for matching
    const { data: indicators } = await supabase
      .from("indicators")
      .select("id, name, slug, unit, description")
      .order("name");

    if (!indicators || indicators.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No indicators configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const indicatorList = indicators
      .map((i) => `- ${i.slug}: ${i.name} (unit: ${i.unit})`)
      .join("\n");

    const articleText = stripHtml(article.body || "");
    const articleDate = article.published_at?.split("T")[0] || new Date().toISOString().split("T")[0];

    // Build the extraction prompt
    const systemPrompt = `You are a data extraction specialist for Ghana economic and statistical indicators. 
Your task is to extract numerical data points from news articles that can update official indicator databases.

Available indicators to match against:
${indicatorList}

RULES:
1. Only extract data points that are EXPLICITLY stated in the article with specific numerical values
2. Match each extracted value to the most appropriate indicator from the list above
3. Include the surrounding context (1-2 sentences) that contains the number
4. Estimate confidence (0.0-1.0) based on source reliability and clarity
5. NEVER fabricate or estimate values - only extract what is explicitly stated
6. For percentages, use the number as-is (e.g., 27% = 27)
7. For currency, convert to the base unit (e.g., GHS millions = multiply by 1,000,000)
8. For production/quantities, use metric tons or appropriate base unit
9. If a date/period is mentioned for the data, use that date; otherwise use article date
10. Only include data points with confidence >= 0.7`;

    const userPrompt = `Extract economic indicator data from this Ghana news article:

TITLE: ${article.title}

CONTENT:
${articleText.slice(0, 6000)}

Article Date: ${articleDate}

Return a JSON object with this structure:
{
  "data_points": [
    {
      "indicator_slug": "slug-from-list-above",
      "indicator_name": "Human readable name",
      "value": 123.45,
      "date": "YYYY-MM-DD",
      "unit": "percent|currency|tonnes|etc",
      "confidence": 0.85,
      "context": "The exact sentence containing this data"
    }
  ]
}

If no reliable data points can be extracted, return: {"data_points": []}`;

    console.log(`Extracting indicators from article: ${article.title}`);

    // Call Lovable AI for extraction
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_indicators",
              description: "Extract indicator data points from article text",
              parameters: {
                type: "object",
                properties: {
                  data_points: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        indicator_slug: { type: "string" },
                        indicator_name: { type: "string" },
                        value: { type: "number" },
                        date: { type: "string" },
                        unit: { type: "string" },
                        confidence: { type: "number" },
                        context: { type: "string" },
                      },
                      required: ["indicator_slug", "indicator_name", "value", "date", "confidence", "context"],
                    },
                  },
                },
                required: ["data_points"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_indicators" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI extraction failed:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let extractedData: ExtractionResult = { data_points: [] };

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }

    console.log(`Extracted ${extractedData.data_points.length} potential data points`);

    // Get Ghana geography
    const { data: ghana } = await supabase
      .from("geographies")
      .select("id")
      .eq("name", "Ghana")
      .eq("type", "country")
      .single();

    if (!ghana) {
      return new Response(
        JSON.stringify({ success: false, error: "Ghana geography not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get article source for attribution
    const { data: articleSource } = await supabase
      .from("data_sources")
      .select("id")
      .eq("short_name", "StatsGH")
      .single();

    const results = {
      extracted: extractedData.data_points.length,
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each extracted data point
    for (const dp of extractedData.data_points) {
      // Skip low confidence
      if (dp.confidence < 0.7) {
        results.skipped++;
        continue;
      }

      // Find matching indicator
      const indicator = indicators.find((i) => i.slug === dp.indicator_slug);
      if (!indicator) {
        console.log(`Indicator not found: ${dp.indicator_slug}`);
        results.skipped++;
        continue;
      }

      // Get or create data series
      let { data: series } = await supabase
        .from("data_series")
        .select("id")
        .eq("indicator_id", indicator.id)
        .eq("geography_id", ghana.id)
        .eq("is_primary", true)
        .single();

      if (!series) {
        const { data: newSeries, error: seriesError } = await supabase
          .from("data_series")
          .insert({
            indicator_id: indicator.id,
            geography_id: ghana.id,
            source_id: articleSource?.id,
            is_primary: true,
            name: `${indicator.name} - Ghana`,
          })
          .select("id")
          .single();

        if (seriesError) {
          results.errors.push(`Failed to create series for ${indicator.slug}: ${seriesError.message}`);
          continue;
        }
        series = newSeries;
      }

      // Insert data point
      const { error: insertError } = await supabase.from("data_points").upsert(
        {
          series_id: series!.id,
          date: dp.date,
          value: dp.value,
          source_note: `Extracted from article: ${article.title}`,
          revision_note: dp.context,
        },
        { onConflict: "series_id,date" }
      );

      if (insertError) {
        results.errors.push(`Failed to insert ${indicator.slug}: ${insertError.message}`);
      } else {
        results.inserted++;
        console.log(`Inserted: ${indicator.name} = ${dp.value} (${dp.date})`);

        // Update indicator timestamp
        await supabase
          .from("indicators")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", indicator.id);

        // Link article to indicator
        await supabase.from("article_indicators").upsert(
          {
            article_id: article_id,
            indicator_id: indicator.id,
            geography_id: ghana.id,
            display_value: String(dp.value),
          },
          { onConflict: "article_id,indicator_id,geography_id" }
        );
      }
    }

    // Log the extraction run
    await supabase.from("ingestion_runs").insert({
      indicator_slug: "article-extraction",
      run_type: "article-ai",
      status: results.errors.length > 0 ? "partial" : "success",
      rows_inserted: results.inserted,
      error_message: results.errors.length > 0 ? results.errors.join("; ") : null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        article_id,
        article_title: article.title,
        extracted: extractedData.data_points,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
