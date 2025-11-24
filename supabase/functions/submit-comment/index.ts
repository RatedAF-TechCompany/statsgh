import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CommentRequest {
  articleId: string;
  name: string;
  email: string;
  body: string;
  parentId?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId, name, email, body, parentId }: CommentRequest = await req.json();

    // Validate input
    if (!articleId || !email || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Comment must be less than 1000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate verification code
    const verificationCode = crypto.randomUUID();
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from("comments")
      .insert({
        article_id: articleId,
        name: name || "Anonymous",
        email,
        body,
        parent_id: parentId || null,
        verification_code: verificationCode,
        verification_expires_at: verificationExpiresAt.toISOString(),
        is_published: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting comment:", insertError);
      throw insertError;
    }

    // Get article title for email
    const { data: article } = await supabase
      .from("articles")
      .select("title, slug")
      .eq("id", articleId)
      .single();

    // Send verification email
    const verificationUrl = `${supabaseUrl.replace('ofhejtwaigiqyejbvncz.supabase.co', 'statsgh.com')}/verify-comment?code=${verificationCode}`;
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "StatsGH <onboarding@resend.dev>",
        to: [email],
        subject: "Verify Your Comment - StatsGH",
        html: `
          <h1>Verify Your Comment</h1>
          <p>Thank you for commenting on "${article?.title || 'our article'}"!</p>
          <p>Please click the link below to verify your email and publish your comment:</p>
          <p><a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #262626; color: #f5e6d8; text-decoration: none; border-radius: 4px;">Verify Comment</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't submit this comment, you can safely ignore this email.</p>
          <p>Best regards,<br>The StatsGH Team</p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send verification email: ${JSON.stringify(errorData)}`);
    }

    const emailData = await emailResponse.json();
    console.log("Verification email sent:", emailData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Comment submitted. Please check your email to verify." 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-comment function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);