import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Query derivation ----------
const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","at","by","from",
  "is","are","was","were","be","been","being","as","that","this","it","its","into",
  "ghana","ghana's","ghanaian","new","says","said","after","over","amid","up","down",
]);

function deriveQuery(title: string, category: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 3);
  if (words.length) return words.join(" ");
  return (category || "ghana business").replace(/-/g, " ");
}

// ---------- Free source: Openverse ----------
// https://api.openverse.engineering/v1/images/ — CC-licensed, no key
async function fetchOpenverse(query: string): Promise<{ url: string; creator: string } | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&aspect_ratio=wide&size=large&page_size=5`;
    const res = await fetch(url, { headers: { "User-Agent": "StatsGH/1.0 (editorial)" } });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data.results || []).find((r: any) => r.url && (r.width ?? 0) >= 700);
    if (!hit) return null;
    return { url: hit.url, creator: hit.creator || "Unknown" };
  } catch (e) {
    console.log("Openverse error:", (e as Error).message);
    return null;
  }
}

// ---------- Free source: Wikimedia Commons ----------
// MediaWiki search API → file info; no key required
async function fetchWikimedia(query: string): Promise<{ url: string; creator: string } | null> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(
      query + " filetype:bitmap"
    )}&srnamespace=6&srlimit=10&origin=*`;
    const sres = await fetch(searchUrl, { headers: { "User-Agent": "StatsGH/1.0" } });
    if (!sres.ok) return null;
    const sdata = await sres.json();
    const hits = sdata.query?.search || [];
    for (const hit of hits) {
      const title = hit.title;
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&titles=${encodeURIComponent(
        title
      )}&iiprop=url|size|extmetadata&origin=*`;
      const ires = await fetch(infoUrl, { headers: { "User-Agent": "StatsGH/1.0" } });
      if (!ires.ok) continue;
      const idata = await ires.json();
      const pages = idata.query?.pages || {};
      const page: any = Object.values(pages)[0];
      const info = page?.imageinfo?.[0];
      if (!info) continue;
      const w = info.width || 0;
      const h = info.height || 0;
      if (w < 700 || h < 1) continue;
      const ratio = w / h;
      if (ratio < 1.2 || ratio > 2.5) continue;
      const creator = (info.extmetadata?.Artist?.value || "Wikimedia").replace(/<[^>]+>/g, "").trim();
      return { url: info.url, creator };
    }
    return null;
  } catch (e) {
    console.log("Wikimedia error:", (e as Error).message);
    return null;
  }
}

// ---------- AI fallback ----------
async function generateAiImage(prompt: string, supabase: any, slug: string): Promise<string | null> {
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return null;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Conceptual editorial photograph for a business news article. Subject: ${prompt}. Single real-world object on a seamless solid colour studio background, shallow depth of field, directional lighting, photorealistic, 16:9. Absolutely no text, no logos, no people.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const m = imageData?.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return null;
    const [, fmt, b64] = m;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = fmt === "png" ? "png" : "jpg";
    const path = `newsroom/${slug}-ai.${ext}`;
    const { error } = await supabase.storage
      .from("media")
      .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : "png"}`, upsert: true });
    if (error) return null;
    return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// ---------- Main ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 10);
    const force = Boolean(body.force ?? false);

    let q = supabase
      .from("articles")
      .select("id, title, slug, section, category_slug, hero_image_url")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (!force) q = q.is("hero_image_url", null);

    const { data: articles, error } = await q;
    if (error) throw error;

    const counts = { openverse: 0, wikimedia: 0, ai: 0, none: 0 };
    const results: any[] = [];

    for (const a of articles || []) {
      const query = deriveQuery(a.title, a.category_slug || a.section || "");
      let url: string | null = null;
      let source = "none";
      let caption = "";

      const ov = await fetchOpenverse(query);
      if (ov) {
        url = ov.url;
        source = "openverse";
        caption = `Photo: ${ov.creator} / Openverse`;
        counts.openverse++;
      } else {
        const wm = await fetchWikimedia(query);
        if (wm) {
          url = wm.url;
          source = "wikimedia";
          caption = `Photo: ${wm.creator} / Wikimedia Commons`;
          counts.wikimedia++;
        } else {
          const ai = await generateAiImage(a.title, supabase, a.slug);
          if (ai) {
            url = ai;
            source = "ai_illustration";
            caption = "Photo illustration: StatsGH";
            counts.ai++;
          } else {
            counts.none++;
          }
        }
      }

      if (url) {
        await supabase
          .from("articles")
          .update({ hero_image_url: url, image_source: source, image_caption: caption })
          .eq("id", a.id);
      }
      results.push({ id: a.id, title: a.title, source, query });
      await new Promise((r) => setTimeout(r, 300));
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, counts, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
