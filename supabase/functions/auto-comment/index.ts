import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ghanaian names pool
const ghanaianNames = [
  "Kwame", "Kofi", "Ama", "Akosua", "Yaw", "Abena", "Kwesi", "Efua",
  "Kojo", "Adjoa", "Kwabena", "Afia", "Nana", "Maame", "Paapa", "Akua",
  "Adom", "Serwaa", "Mensah", "Owusu", "Asante", "Boateng", "Osei", "Amponsah",
  "Dede", "Nii", "Naa", "Adwoa", "Yaa", "Afua", "Akweley", "Lamptey",
  "Korkor", "Adjei", "Tetteh", "Quaye", "Dzifa", "Selasi", "Edem", "Sena"
];

const commentStyles = [
  "reaction",
  "question", 
  "opinion",
  "concern",
  "local_context",
  "call_to_action",
  "skeptical",
  "supportive",
  "personal_story",
  "humor"
];

function getRandomName(): string {
  return ghanaianNames[Math.floor(Math.random() * ghanaianNames.length)];
}

function getRandomStyle(): string {
  return commentStyles[Math.floor(Math.random() * commentStyles.length)];
}

function buildPrompt(article: { title: string; summary: string; category_slug: string }, style: string): string {
  return `You are a Ghanaian reader commenting on a news article. Write a single, authentic comment as if you're a regular person reacting to this news.

Article Title: ${article.title}

Article Summary: ${article.summary}

Category: ${article.category_slug}

Comment style to use: ${style}

Style guidelines:
- "reaction": Short 1-2 sentence emotional reaction (e.g., "Eiiii this one too?", "Herh! Finally!")
- "question": Ask a follow-up question about what happened
- "opinion": Share your take on the matter
- "concern": Express worry about the issue or what it means for Ghana
- "local_context": Reference being from Ghana, knowing the area, or similar experiences
- "call_to_action": Suggest what government, police, or people should do
- "skeptical": Express doubt or ask for more proof ("But wait, how they take know?", "Something dey inside this story")
- "supportive": Show support or encouragement 
- "personal_story": Briefly relate it to something you witnessed or experienced
- "humor": Light sarcastic or witty observation (not offensive)

GHANAIAN EXPRESSIONS TO USE NATURALLY (pick 0-2 per comment):
- "Eiiii" or "Eiii" - surprise/shock
- "Herh!" or "Herhh" - disbelief/amazement  
- "Chale" - friend/buddy, casual address
- "Chai" - expression of frustration or resignation
- "Hmm" or "Hmmm" - thoughtful concern
- "Masa" - boss/sir (casual)
- "Wofa" - uncle (respectful address)
- "Charley" - friend (Accra slang)
- "Tweaaa" - dismissive disbelief
- "Ah but..." - contradiction opener
- "Wo maame" - exclamation (mild)
- "Gyimii" - foolishness
- "Ajeii" - expression of pity/sympathy
- "Paa" - emphasis word ("true paa", "hard paa")
- "Koraa" - at all/even ("I no understand koraa")
- "Kraa" - same as koraa
- "Abi" - right?/isn't it?
- "Wey" - which/that (pidgin)
- "Dey" - there/is (pidgin)
- "Make" - let (pidgin: "make we see")
- "Sef" - even/self ("me sef I dey confused")
- "Paaa" - very/really ("this one serious paaa")
- "Small small" - gradually
- "Somehow" - it's complicated/strange
- "By force by force" - forcefully/insistently
- "Wahala" - trouble/problem
- "No be small" - it's serious/not minor
- "Shege" - expression of frustration

PIDGIN PHRASES (use occasionally):
- "E no easy o" - it's not easy
- "This country sef" - frustrated with Ghana
- "We dey watch" - we're observing
- "God dey" - God is watching/in control
- "Na wa o" - expression of disbelief
- "Dem go hear am" - they will face consequences
- "Wetin dey happen?" - what's happening?
- "No be today" - this isn't new
- "Make dem try" - let them try
- "E pain me" - it hurts me/I'm upset

CRITICAL RULES:
- Write 1-3 sentences MAX (most comments should be 1-2 sentences)
- Mix standard English with occasional Ghanaian expressions NATURALLY
- Do NOT force expressions - some comments can be plain English
- Do NOT use emojis
- Do NOT use hashtags  
- Do NOT be overly formal or journalistic
- Sound like a real person scrolling through news on their phone
- Can have slightly informal grammar like real comments
- Reference specific details from the article to seem genuine
- Vary sentence length - some short punchy, some slightly longer
- Can start mid-thought ("Ah but why..." or "So now what...")

BAD EXAMPLES (too forced):
- "Eiiii chale herh chai this one no be small wahala o!" (too many expressions)
- "As a proud Ghanaian citizen, I am deeply concerned..." (too formal)

GOOD EXAMPLES:
- "Herh! So this man was doing this all along and nobody knew?"
- "This country sef. Every day new story."
- "But wait, who gave them the contract in the first place? Make we ask that one too"
- "Ajeii the family must be going through a lot. God comfort them"
- "I live around that area. The traffic there is always terrible paa"
- "Finally! I've been waiting for them to take action on this"

Return ONLY the comment text, nothing else.`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch article details
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("title, summary, category_slug")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      console.error("Error fetching article:", articleError);
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const style = getRandomStyle();
    const prompt = buildPrompt(article, style);

    // Generate comment using Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate comment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const commentBody = aiData.choices?.[0]?.message?.content?.trim();

    if (!commentBody) {
      return new Response(
        JSON.stringify({ error: "No comment generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a fake verification code (already verified)
    const verificationCode = crypto.randomUUID();
    const name = getRandomName();
    const fakeEmail = `${name.toLowerCase()}${Math.floor(Math.random() * 999)}@reader.local`;

    // Insert as already-published comment
    const { data: comment, error: insertError } = await supabase
      .from("comments")
      .insert({
        article_id: articleId,
        name: name,
        email: fakeEmail,
        body: commentBody,
        verification_code: verificationCode,
        verification_expires_at: new Date().toISOString(),
        is_published: true,
        parent_id: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting comment:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save comment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Auto-comment created for article ${articleId}: "${commentBody.substring(0, 50)}..." by ${name} (style: ${style})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        comment: {
          id: comment.id,
          name: name,
          body: commentBody,
          style: style
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in auto-comment function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
