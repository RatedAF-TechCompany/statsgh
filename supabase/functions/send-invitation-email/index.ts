import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  fullName: string;
  role: string;
  inviteLink: string;
  invitedBy: string;
  note?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, role, inviteLink, invitedBy, note }: InvitationEmailRequest = await req.json();

    console.log("Sending invitation email to:", email);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "STATSGH Chronicle <onboarding@resend.dev>",
        to: [email],
        subject: `You've been invited to join STATSGH Chronicle as ${role}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>STATSGH Chronicle Invitation</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="padding: 40px 40px 24px; text-align: center; border-bottom: 1px solid #e5e5e5;">
                          <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #1a1a1a; letter-spacing: 0.05em;">
                            STATSGH CHRONICLE
                          </h1>
                        </td>
                      </tr>
                      
                      <!-- Body -->
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                            Welcome to STATSGH Chronicle, ${fullName}!
                          </h2>
                          
                          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #525252;">
                            You've been invited by <strong>${invitedBy}</strong> to join the STATSGH Chronicle content management system.
                          </p>
                          
                          <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0; border-radius: 4px;">
                            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                              Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
                            </p>
                            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #525252;">
                              ${getRoleDescription(role)}
                            </p>
                          </div>
                          
                          ${note ? `
                            <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 16px; margin: 24px 0; border-radius: 4px;">
                              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1a1a1a;">
                                Note from ${invitedBy}:
                              </p>
                              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #525252;">
                                ${note}
                              </p>
                            </div>
                          ` : ''}
                          
                          <p style="margin: 24px 0 16px; font-size: 16px; line-height: 1.6; color: #525252;">
                            Click the button below to accept your invitation and set up your account:
                          </p>
                          
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td align="center" style="padding: 24px 0;">
                                <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; transition: background-color 0.2s;">
                                  Accept Invitation
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 16px 0 0; font-size: 14px; line-height: 1.6; color: #737373;">
                            Or copy and paste this link into your browser:<br>
                            <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">
                              ${inviteLink}
                            </a>
                          </p>
                          
                          <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #737373;">
                            This invitation link will expire in 7 days.
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 24px 40px; border-top: 1px solid #e5e5e5; text-align: center;">
                          <p style="margin: 0; font-size: 13px; color: #a3a3a3;">
                            If you didn't expect this invitation, you can safely ignore this email.
                          </p>
                          <p style="margin: 16px 0 0; font-size: 13px; color: #a3a3a3;">
                            © ${new Date().getFullYear()} STATSGH Chronicle. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const data = await emailResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function getRoleDescription(role: string): string {
  const descriptions = {
    admin: "Full access to all features including user management, content creation, publishing, and system settings.",
    editor: "Can create, edit, publish, and delete articles. Cannot manage users or site settings.",
    contributor: "Can create and edit their own drafts. Articles must be published by an Editor or Admin.",
  };
  return descriptions[role as keyof typeof descriptions] || "Access to the content management system.";
}

serve(handler);
