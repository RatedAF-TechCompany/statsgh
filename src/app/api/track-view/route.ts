import { NextRequest, NextResponse } from "next/server";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, userAgent, referrer, deviceType } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    const supabase = createReadOnlyServerClient();

    const { error } = await supabase.from("article_views").insert({
      article_id: articleId,
      user_agent: userAgent || null,
      referrer: referrer || null,
      device_type: deviceType || "unknown",
    });

    if (error) {
      console.error("Error tracking view:", error);
      return NextResponse.json(
        { error: "Failed to track view" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in track-view API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
