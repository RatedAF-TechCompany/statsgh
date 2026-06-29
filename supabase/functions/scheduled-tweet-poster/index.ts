import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── OAuth helpers ──

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createOAuthSignature(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const signatureBase = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureBase));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function postTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY")!;
  const CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET")!;
  const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")!;
  const ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")!;

  const tweetUrl = "https://api.x.com/2/tweets";
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const signature = await createOAuthSignature("POST", tweetUrl, oauthParams, CONSUMER_SECRET, ACCESS_TOKEN_SECRET);
  oauthParams.oauth_signature = signature;

  const authHeader = "OAuth " + Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");

  const res = await fetch(tweetUrl, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: `X API ${res.status}: ${JSON.stringify(data)}` };
  }
  return { success: true, tweetId: data?.data?.id };
}

// ── Stat content detection ──

const STAT_REGEX = /[0-9%$₵¢£€]|GHS|USD|GH¢/;
const QUANTITY_WORDS = /\b(million|billion|thousand|tonnes|barrels|litres|km|MW|GW)\b/i;

function containsStatContent(text: string): boolean {
  return STAT_REGEX.test(text) || QUANTITY_WORDS.test(text);
}

// ── Present perfect tense validator ──
function hasPresentPerfectTense(text: string): boolean {
  const first60 = text.substring(0, 60).toLowerCase();
  return first60.includes(" has ") || first60.includes(" have ");
}

// ── AI condensation ──

async function condenseTweet(text: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) { console.error("[scheduled-tweet-poster] LOVABLE_API_KEY not set"); return null; }

  const prompt = `Rewrite into ONE complete English sentence UNDER 150 characters. The tweet MUST contain at least one number.

TENSE RULE (CRITICAL — MUST FOLLOW):
- The tweet MUST be written in present perfect tense: [Subject] has/have [past participle] [rest of sentence].
- Example correct form: Ghana has secured $500 million from the World Bank for infrastructure improvements in roads and energy.
- Example wrong form: Ghana secures $500 million.
- Example wrong form: Ghana secured $500 million.
- Example wrong form: Ghana has said it will secure.
- Always lead with the subject, then "has" or "have", then the past participle.

SENTENCE CASE RULES (CRITICAL):
- Write as a normal English sentence, NOT a headline.
- Only the first word of the sentence gets a capital letter.
- Only capitalize proper nouns (names, places, institutions, organizations).

STRICT RULES:
- The tweet MUST contain at least one number (digits, percentages, currency values, years)
- Maximum 150 characters
- Must end with a period
- No emojis, hashtags, links, or dashes
- Sentence case (not title case)
- Use "GHS" for Ghana cedi values
- Output ONLY the sentence

Original: ${text}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100,
          temperature: attempt === 0 ? 0.3 : 0.5,
        }),
      });

      if (!res.ok) { console.error(`[scheduled-tweet-poster] AI attempt ${attempt} failed:`, res.status); continue; }

      const data = await res.json();
      const condensed = data.choices?.[0]?.message?.content?.trim();
      if (!condensed) continue;

      const cleaned = condensed.replace(/^["']|["']$/g, "").trim();
      if (cleaned.length > 150) continue;
      if (!cleaned.endsWith(".")) continue;
      if (!containsStatContent(cleaned)) continue;
      const validation = validateTweet(cleaned);
      if (!validation.valid) continue;

      if (!hasPresentPerfectTense(cleaned)) {
        console.log(`[scheduled-tweet-poster] Attempt ${attempt}: WRONG_TENSE — "${cleaned}"`);
        continue;
      }

      return cleaned;
    } catch (err) {
      console.error(`[scheduled-tweet-poster] AI attempt ${attempt} error:`, err);
    }
  }

  console.log(`[scheduled-tweet-poster] condenseTweet failed after 2 attempts (WRONG_TENSE or other)`);
  return null;
}

// ── Time helpers for Africa/Accra (UTC+0) ──

function getAccraHour(): number {
  return new Date().getUTCHours();
}

function isInQuietHours(quietStart: string, quietEnd: string): boolean {
  const hour = getAccraHour();
  const [startH] = quietStart.split(":").map(Number);
  const [endH] = quietEnd.split(":").map(Number);
  if (startH <= endH) return hour >= startH && hour < endH;
  return hour >= startH || hour < endH;
}

// ── Smart selection ──

const BUSINESS_HIGH = ["economy", "markets", "prices", "trade", "finance", "policy", "tax", "energy", "jobs", "infrastructure"];
const BUSINESS_MED = ["agriculture", "tech", "demographics"];
const OFF_HIGH = ["demographics", "tech", "education", "health"];

function getCategoryWeight(category: string, hour: number): number {
  const cat = category.toLowerCase();
  if (hour >= 7 && hour < 20) {
    if (BUSINESS_HIGH.includes(cat)) return 3;
    if (BUSINESS_MED.includes(cat)) return 2;
    return 1;
  } else if (hour >= 20 && hour < 23) {
    if (OFF_HIGH.includes(cat)) return 2;
    return 1;
  }
  return 1;
}

function weightedRandomSelect(items: Array<{ hash: string; text: string; category: string }>): { hash: string; text: string; category: string } | null {
  if (items.length === 0) return null;
  const hour = getAccraHour();
  const weighted = items.map(item => ({ item, weight: getCategoryWeight(item.category, hour) }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const w of weighted) {
    rand -= w.weight;
    if (rand <= 0) return w.item;
  }
  return weighted[weighted.length - 1].item;
}

// ── Validation ──

const DANGLING_ENDINGS = new Set(["the","a","an","to","in","on","at","of","for","and","or","by","with","from","its","their","his","her","our","your","this","that","which","who","whom","whose","into","over","per","as","but","than","also"]);

function validateTweet(text: string): { valid: boolean; reason?: string } {
  if (!containsStatContent(text)) return { valid: false, reason: "NO_STAT_CONTENT" };
  if (text.length > 150) return { valid: false, reason: "over_150_chars" };
  if (text.includes("#")) return { valid: false, reason: "contains_hashtag" };
  if (text.match(/https?:\/\//)) return { valid: false, reason: "contains_link" };
  if (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)) return { valid: false, reason: "contains_emoji" };
  if (text.includes("—") || text.includes("–")) return { valid: false, reason: "contains_long_dash" };
  if (text.endsWith(".")) {
    const words = text.replace(/\.$/, "").trim().split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase().replace(/[^a-z]/g, "");
    if (DANGLING_ENDINGS.has(lastWord)) return { valid: false, reason: `truncated_ending_${lastWord}` };
  }
  if (text.includes("...") || text.includes("…")) return { valid: false, reason: "contains_ellipsis" };
  if (!text.endsWith(".")) return { valid: false, reason: "missing_period" };
  return { valid: true };
}

// ════════════════════════════════════════════
// SCHEDULED TWEET POSTER — EVERGREEN ONLY
// Posts from tweet_bank_items (pure stat tweets, no article links).
// Runs every 4 hours via pg_cron.
// ════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "scheduled";
    const overrideQuiet = body.override_quiet === true;

    // ── Save tweets action ──
    if (action === "save_tweets") {
      const lines: string[] = body.lines || [];
      if (!lines.length) {
        return new Response(JSON.stringify({ error: "No tweets provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const items: Array<{ text: string; category: string; hash: string }> = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let category = "general";
        let text = trimmed;
        const tagMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)/);
        if (tagMatch) {
          category = tagMatch[1].toLowerCase().trim();
          text = tagMatch[2].trim();
        }
        if (!text) continue;
        if (!containsStatContent(text)) continue;
        if (text.length > 150) {
          const condensed = await condenseTweet(text);
          if (condensed) text = condensed;
        }
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        items.push({ text, category, hash });
      }

      for (const item of items) {
        await supabase.from("tweet_bank_items").upsert(
          { text: item.text, category: item.category, hash: item.hash, is_active: true },
          { onConflict: "hash" }
        );
      }

      await rebuildQueue(supabase);

      return new Response(JSON.stringify({ success: true, count: items.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Reset cycle ──
    if (action === "reset_cycle") {
      const newCycleId = crypto.randomUUID();
      const { data: activeItems } = await supabase
        .from("tweet_bank_items")
        .select("hash")
        .eq("is_active", true);
      const queueHashes = (activeItems || []).map((i: any) => i.hash);

      await supabase.from("tweet_scheduler_state").update({
        cycle_id: newCycleId,
        posted_hashes: [],
        queue_hashes: queueHashes,
      }).eq("id", 1);

      await supabase.from("tweet_scheduler_logs").insert({
        tweet_text: null,
        category: null,
        status: "skipped",
        reason: "cycle_reset",
        cycle_id: newCycleId,
      });

      return new Response(JSON.stringify({ success: true, cycle_id: newCycleId, queue_size: queueHashes.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Scheduled or Post Now ──

    const { data: state, error: stateError } = await supabase
      .from("tweet_scheduler_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (stateError || !state) {
      throw new Error("Failed to read scheduler state: " + (stateError?.message || "no state row"));
    }

    if (action === "scheduled" && !state.is_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "scheduler_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (state.quiet_hours_enabled && !overrideQuiet && isInQuietHours(state.quiet_start, state.quiet_end)) {
      await supabase.from("tweet_scheduler_logs").insert({
        status: "skipped",
        reason: "quiet_hours",
        cycle_id: state.cycle_id,
      });
      return new Response(JSON.stringify({ skipped: true, reason: "quiet_hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DAILY LIMIT GATE: max 2 tweets per 24h ──
    {
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: dailyCount } = await supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .like("twitter_post", "POSTED:%")
        .gte("updated_at", cutoff24h);

      if ((dailyCount ?? 0) >= 2) {
        console.log(`[scheduled-tweet-poster] DAILY_LIMIT_REACHED: ${dailyCount} tweets posted in last 24h. Skipping.`);
        await supabase.from("tweet_scheduler_logs").insert({
          status: "skipped",
          reason: `DAILY_LIMIT_REACHED: ${dailyCount} tweets in last 24h`,
          cycle_id: state.cycle_id,
        });
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "DAILY_LIMIT_REACHED", message: `${dailyCount} tweets already posted in last 24h (max 2)` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 3-HOUR MINIMUM GAP GATE ──
    if (state.last_posted_at) {
      const lastPostedMs = new Date(state.last_posted_at).getTime();
      const elapsedMinutes = (Date.now() - lastPostedMs) / 60000;
      if (elapsedMinutes < 180) {
        const minutesRemaining = Math.ceil(180 - elapsedMinutes);
        console.log(`[scheduled-tweet-poster] TOO_SOON: ${Math.floor(elapsedMinutes)}min since last tweet, ${minutesRemaining}min remaining`);
        await supabase.from("tweet_scheduler_logs").insert({
          status: "skipped",
          reason: `TOO_SOON: ${minutesRemaining}min remaining`,
          cycle_id: state.cycle_id,
        });
        return new Response(JSON.stringify({ skipped: true, reason: "TOO_SOON", minutes_remaining: minutesRemaining }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let queueHashes: string[] = state.queue_hashes || [];
    let cycleId = state.cycle_id;
    let postedHashes: string[] = state.posted_hashes || [];

    if (queueHashes.length === 0) {
      const rebuildResult = await rebuildQueue(supabase);
      if (rebuildResult) {
        queueHashes = rebuildResult.queueHashes;
        cycleId = rebuildResult.cycleId;
        postedHashes = rebuildResult.postedHashes;
      }
    }

    if (queueHashes.length === 0) {
      await supabase.from("tweet_scheduler_logs").insert({
        status: "skipped", reason: "no_valid_tweet", cycle_id: cycleId,
      });
      return new Response(JSON.stringify({ skipped: true, reason: "no_tweets_in_queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch queue items in batches
    const queueSet = new Set(queueHashes);
    const BATCH_SIZE = 50;
    const hashBatches: string[][] = [];
    const queueHashArray = [...queueSet];
    for (let i = 0; i < queueHashArray.length; i += BATCH_SIZE) {
      hashBatches.push(queueHashArray.slice(i, i + BATCH_SIZE));
    }

    let queueItems: Array<{ hash: string; text: string; category: string; data_date: string | null }> = [];
    for (const batch of hashBatches) {
      const { data: batchItems } = await supabase
        .from("tweet_bank_items")
        .select("hash, text, category, data_date")
        .eq("is_active", true)
        .in("hash", batch);
      if (batchItems) queueItems = queueItems.concat(batchItems as any);
      if (queueItems.length >= 50) break;
    }

    if (!queueItems || queueItems.length === 0) {
      await supabase.from("tweet_scheduler_logs").insert({
        status: "skipped", reason: "no_valid_tweet", cycle_id: cycleId,
      });
      return new Response(JSON.stringify({ skipped: true, reason: "no_active_tweets_match_queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to find a valid tweet via smart selection
    let selectedTweet: { hash: string; text: string; category: string; data_date: string | null } | null = null;
    const tried = new Set<string>();
    const maxAttempts = Math.min(queueItems.length, 20);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remaining = queueItems.filter(i => !tried.has(i.hash));
      if (remaining.length === 0) break;

      const candidate = weightedRandomSelect(remaining)!;
      tried.add(candidate.hash);

      let tweetText = candidate.text;

      if (!containsStatContent(tweetText)) {
        await supabase.from("tweet_scheduler_logs").insert({
          tweet_text: tweetText, category: candidate.category,
          status: "skipped", reason: "NO_STAT_CONTENT", cycle_id: cycleId,
        });
        queueHashes = queueHashes.filter(h => h !== candidate.hash);
        postedHashes = [...postedHashes, candidate.hash];
        continue;
      }

      const validation = validateTweet(tweetText);
      if (!validation.valid) {
        await supabase.from("tweet_scheduler_logs").insert({
          tweet_text: tweetText, category: candidate.category,
          status: "skipped", reason: validation.reason, cycle_id: cycleId,
        });
        queueHashes = queueHashes.filter(h => h !== candidate.hash);
        postedHashes = [...postedHashes, candidate.hash];
        continue;
      }

      if (tweetText.length > 150) {
        const condensed = await condenseTweet(tweetText);
        if (!condensed) {
          await supabase.from("tweet_scheduler_logs").insert({
            tweet_text: candidate.text, category: candidate.category,
            status: "skipped", reason: "too_long_condense_failed", cycle_id: cycleId,
          });
          queueHashes = queueHashes.filter(h => h !== candidate.hash);
          postedHashes = [...postedHashes, candidate.hash];
          continue;
        }
        tweetText = condensed;
      }

      selectedTweet = { ...candidate, text: tweetText };
      break;
    }

    if (!selectedTweet) {
      await supabase.from("tweet_scheduler_state").update({
        queue_hashes: queueHashes, posted_hashes: postedHashes,
      }).eq("id", 1);

      await supabase.from("tweet_scheduler_logs").insert({
        status: "skipped", reason: "no_valid_tweet", cycle_id: cycleId,
      });
      return new Response(JSON.stringify({ skipped: true, reason: "no_valid_tweet_after_filtering" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Post tweet ──
    const finalText = selectedTweet.text;
    console.log(`[scheduled-tweet-poster] Posting: "${finalText}"`);
    let postResult = await postTweet(finalText);

    if (!postResult.success) {
      console.log("[scheduled-tweet-poster] First attempt failed, retrying in 5s...", postResult.error);
      await new Promise(r => setTimeout(r, 5000));
      postResult = await postTweet(finalText);
    }

    if (postResult.success) {
      const newPosted = [...postedHashes, selectedTweet.hash];
      const newQueue = queueHashes.filter(h => h !== selectedTweet!.hash);

      const updateData: any = {
        posted_hashes: newPosted,
        queue_hashes: newQueue,
        last_posted_at: new Date().toISOString(),
        last_posted_hash: selectedTweet.hash,
        fail_count_24h: 0,
      };

      if (newQueue.length === 0) {
        const { data: activeItems } = await supabase
          .from("tweet_bank_items")
          .select("hash")
          .eq("is_active", true);
        const allHashes = (activeItems || []).map((i: any) => i.hash);
        updateData.cycle_id = crypto.randomUUID();
        updateData.posted_hashes = [];
        updateData.queue_hashes = allHashes;
      }

      await supabase.from("tweet_scheduler_state").update(updateData).eq("id", 1);

      await supabase.from("tweet_scheduler_logs").insert({
        tweet_text: finalText, category: selectedTweet.category,
        status: "success", tweet_id: postResult.tweetId,
        cycle_id: updateData.cycle_id || cycleId,
      });

      return new Response(JSON.stringify({
        success: true, tweet_id: postResult.tweetId,
        text: finalText, queue_remaining: updateData.queue_hashes?.length ?? newQueue.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const now = new Date().toISOString();
      await supabase.from("tweet_scheduler_state").update({
        last_error_at: now,
        fail_count_24h: (state.fail_count_24h || 0) + 1,
        queue_hashes: queueHashes, posted_hashes: postedHashes,
      }).eq("id", 1);

      await supabase.from("tweet_scheduler_logs").insert({
        tweet_text: selectedTweet.text, category: selectedTweet.category,
        status: "failed", error_message: postResult.error, cycle_id: cycleId,
      });

      return new Response(JSON.stringify({ success: false, error: postResult.error }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[scheduled-tweet-poster] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helper: rebuild queue ──
async function rebuildQueue(supabase: any): Promise<{ queueHashes: string[]; cycleId: string; postedHashes: string[] } | null> {
  const { data: state } = await supabase
    .from("tweet_scheduler_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (!state) return null;

  const { data: activeItems } = await supabase
    .from("tweet_bank_items")
    .select("hash")
    .eq("is_active", true);

  const allHashes = (activeItems || []).map((i: any) => i.hash);
  const postedSet = new Set(state.posted_hashes || []);
  let queueHashes = allHashes.filter((h: string) => !postedSet.has(h));

  let cycleId = state.cycle_id;
  let postedHashes = state.posted_hashes || [];

  if (queueHashes.length === 0 && allHashes.length > 0) {
    cycleId = crypto.randomUUID();
    postedHashes = [];
    queueHashes = allHashes;
  }

  await supabase.from("tweet_scheduler_state").update({
    queue_hashes: queueHashes,
    cycle_id: cycleId,
    posted_hashes: postedHashes,
  }).eq("id", 1);

  return { queueHashes, cycleId, postedHashes };
}
