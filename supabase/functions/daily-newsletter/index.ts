import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Get top 5 articles from last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: topStories } = await supabase
    .from("articles")
    .select("id, title, slug, category_slug, summary, published_at")
    .eq("is_published", true)
    .gte("published_at", yesterday)
    .order("published_at", { ascending: false })
    .limit(5);

  // 2. Get key indicators from ghana-at-glance
  const glanceRes = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ghana-at-glance`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "Content-Type": "application/json",
      },
    }
  );
  const glanceData = glanceRes.ok ? await glanceRes.json() : null;

  // 3. Get all user emails
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError || !authUsers?.users?.length) {
    return new Response(
      JSON.stringify({ error: "No users found", detail: authError?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const emails = authUsers.users
    .filter((u) => u.email && u.email_confirmed_at)
    .map((u) => u.email!);

  if (emails.length === 0) {
    return new Response(
      JSON.stringify({ message: "No confirmed email users to send to" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. Build email HTML
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const storyRows = (topStories || [])
    .map(
      (s, i) =>
        `<tr>
          <td style="padding:12px 0;border-bottom:1px solid #E0CDB5;">
            <span style="color:#9A0044;font-weight:600;font-size:14px;">${i + 1}.</span>
            <a href="https://statsgh.lovable.app/${s.category_slug}/${s.slug}" 
               style="color:#000;text-decoration:none;font-family:Georgia,serif;font-size:16px;font-weight:600;">
              ${s.title}
            </a>
            <p style="color:#5F5A56;font-size:13px;margin:4px 0 0 0;font-family:Inter,sans-serif;">
              ${s.summary?.substring(0, 120)}...
            </p>
          </td>
        </tr>`
    )
    .join("");

  const indicatorCards = (glanceData?.cards || [])
    .slice(0, 6)
    .map(
      (c: any) =>
        `<td style="padding:8px;text-align:center;width:33%;border:1px solid #E0CDB5;">
          <p style="font-size:11px;color:#5F5A56;margin:0;">${c.label}</p>
          <p style="font-size:18px;font-weight:700;color:#000;margin:4px 0 0;">${c.value}</p>
          <p style="font-size:10px;color:#5F5A56;margin:2px 0 0;">${c.sublabel || ""}</p>
        </td>`
    )
    .join("");

  const indicatorRows: string[] = [];
  for (let i = 0; i < (glanceData?.cards || []).slice(0, 6).length; i += 3) {
    indicatorRows.push(
      `<tr>${(glanceData?.cards || []).slice(i, i + 3).map(
        (c: any) =>
          `<td style="padding:8px;text-align:center;width:33%;border:1px solid #E0CDB5;">
            <p style="font-size:11px;color:#5F5A56;margin:0;">${c.label}</p>
            <p style="font-size:18px;font-weight:700;color:#000;margin:4px 0 0;">${c.value}</p>
            <p style="font-size:10px;color:#5F5A56;margin:2px 0 0;">${c.sublabel || ""}</p>
          </td>`
      ).join("")}</tr>`
    );
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F7F1E1;font-family:Inter,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#F7F1E1;">
    <tr>
      <td style="padding:24px 20px 16px;text-align:center;border-bottom:3px solid #9A0044;">
        <h1 style="font-family:Georgia,serif;font-size:28px;color:#9A0044;margin:0;">StatsGH</h1>
        <p style="font-size:13px;color:#5F5A56;margin:6px 0 0;">Morning Briefing — ${today}</p>
      </td>
    </tr>

    <!-- Key Numbers -->
    <tr>
      <td style="padding:20px;">
        <h2 style="font-family:Georgia,serif;font-size:18px;color:#000;margin:0 0 12px;">📊 Key Numbers</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;">
          ${indicatorRows.join("")}
        </table>
      </td>
    </tr>

    <!-- Top Stories -->
    <tr>
      <td style="padding:0 20px 20px;">
        <h2 style="font-family:Georgia,serif;font-size:18px;color:#000;margin:0 0 12px;">📰 Top Stories</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${storyRows || '<tr><td style="padding:12px 0;color:#5F5A56;">No new stories in the last 24 hours.</td></tr>'}
        </table>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="padding:0 20px 24px;text-align:center;">
        <a href="https://statsgh.lovable.app" 
           style="display:inline-block;background:#9A0044;color:#F7F1E1;padding:12px 32px;text-decoration:none;font-weight:600;border-radius:4px;">
          Read More on StatsGH →
        </a>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:16px 20px;border-top:1px solid #E0CDB5;text-align:center;">
        <p style="font-size:11px;color:#5F5A56;margin:0;">
          StatsGH — Ghana's data-driven news platform.<br>
          You're receiving this because you have a StatsGH account.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // 5. Send via Resend (batch, max 50 per call)
  let sentCount = 0;
  const batchSize = 50;
  const errors: string[] = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    try {
      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "StatsGH <briefing@statsgh.com>",
          to: batch,
          subject: `StatsGH Morning Briefing — ${today}`,
          html: emailHtml,
        }),
      });

      if (sendRes.ok) {
        sentCount += batch.length;
      } else {
        const errBody = await sendRes.text();
        errors.push(`Batch ${i}: ${errBody}`);
      }
    } catch (e) {
      errors.push(`Batch ${i}: ${e.message}`);
    }
  }

  // 6. Log the send
  await supabase.from("newsletter_sends").insert({
    subject: `StatsGH Morning Briefing — ${today}`,
    recipients_count: sentCount,
    top_stories: topStories,
    key_indicators: glanceData?.cards?.slice(0, 6) || [],
    status: errors.length ? "partial" : "sent",
    error_message: errors.length ? errors.join("; ") : null,
  });

  return new Response(
    JSON.stringify({
      success: true,
      sent: sentCount,
      total_users: emails.length,
      errors: errors.length ? errors : undefined,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
