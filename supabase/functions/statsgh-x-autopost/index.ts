// THE ONLY StatsGH X autopost path.
// crime gate + duplicate gate + eligibility BEFORE the model -> master prompt ->
// code-side house checks -> review queue (social_posts) -> post (cap/gap/quiet hours).
// Kill switch: system_flags AUTO_TWEET_ENABLED. Defaults to review_only mode.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";
import { autoTweetEnabled } from "../_shared/auto-tweet-flag.ts";
import { callGateway, parseJson, GatewayHaltError } from "../_shared/ai-gateway.ts";
import { loadTwitterCredentials, postTweet } from "../_shared/twitter-oauth.ts";
import { headlineSimilarity, validateStatisticalArticle } from "../_shared/statistical-validator.ts";
import { finalTweetValidator } from "../_shared/editorial-gate.ts";
import { crimeGate } from "../_shared/crime-gate.ts";
import { runHouseChecks, failedChecks } from "../_shared/statsgh-house-checks.ts";
import { weightedLength } from "../_shared/x-text.ts";
import { STATSGH_MASTER_PROMPT, PROMPT_VERSION } from "../_shared/statsgh-master-prompt.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SITE = "https://www.statsgh.com";
const articleUrl = (a: any) => `${SITE}/${a.category_slug}/${a.slug}`;
const stripHtml = (s: string) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const DAY = 86400_000;
// Ghana is UTC+0 all year, so Accra time == UTC.
const accraDayStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString(); };

const ARTICLE_COLS = "id, title, summary, body, slug, category_slug, section, tags, editorial_category, event_id, event_fingerprint, published_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = await authorizeCaller(req, db);
  if (!auth.ok) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as { action?: string; id?: string; edited_text?: string; dry_run?: boolean };
  const action = body.action || "run";

  const { data: settings } = await db.from("x_autopost_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return json({ error: "x_autopost_settings missing" }, 500);

  /* ---------------- review actions (admin/editor only, no AI, no posting) ---------------- */
  if (action === "approve" || action === "discard") {
    if (!auth.userId) return json({ error: "Admin or editor login required" }, 403);
    const { data: row } = await db.from("social_posts").select("*").eq("id", body.id ?? "").maybeSingle();
    if (!row || !["held", "approved"].includes(row.status)) return json({ error: "Row not found or not reviewable" }, 404);
    const now = new Date().toISOString();
    if (action === "discard") {
      await db.from("social_posts").update({ status: "discarded", reviewed_by: auth.userId, reviewed_at: now }).eq("id", row.id);
      return json({ status: "discarded" });
    }
    const { data: art } = await db.from("articles").select(ARTICLE_COLS).eq("id", row.article_id).maybeSingle();
    if (!art) return json({ error: "Article missing" }, 404);
    if (crimeGate(art).blocked) return json({ status: "held", failed: ["crime"] }, 422);
    const text = (body.edited_text ?? row.edited_text ?? row.post_text ?? "").trim();
    const recent = await recentTopics(db, row.id);
    const hc = runHouseChecks({ post: text, article: art, url: articleUrl(art), modelJson: row.model_output, recentTopicKeys: recent });
    const failed = failedChecks(hc.checks);
    await db.from("social_posts").update({
      edited_text: body.edited_text ?? row.edited_text, code_checks_json: hc.checks, char_count: weightedLength(text),
      ...(failed.length ? { reject_reason: `failed: ${failed.join(",")}` } : { status: "approved", reviewed_by: auth.userId, reviewed_at: now }),
    }).eq("id", row.id);
    if (failed.length) return json({ status: "held", failed, checks: hc.checks }, 422);
    return json({ status: "approved" });
  }

  /* ---------------- run ---------------- */
  if (!(await autoTweetEnabled())) return json({ halted: true, code: "AUTO_TWEET_DISABLED" });
  if (Deno.env.get("AUTOPOST_ENABLED") === "false") return json({ halted: true, code: "AUTOPOST_ENABLED_false" });

  const dry = body.dry_run === true;
  const summary: Record<string, unknown> = { at: new Date().toISOString(), dry_run: dry, mode: settings.mode, by: auth.via, rows: [] as unknown[] };
  const finish = async (extra: Record<string, unknown>) => {
    Object.assign(summary, extra);
    await db.from("x_autopost_settings").update({ last_run_at: new Date().toISOString(), last_run_summary: summary }).eq("id", 1);
    return json(summary);
  };

  // Slot checks.
  const hour = new Date().getUTCHours();
  const qs = settings.quiet_start_utc, qe = settings.quiet_end_utc;
  const inQuiet = qs > qe ? (hour >= qs || hour < qe) : (hour >= qs && hour < qe);
  const dayStart = accraDayStart();
  const { count: postedToday } = await db.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "posted").gte("posted_at", dayStart);
  const { data: lastPost } = await db.from("social_posts").select("posted_at").eq("status", "posted").order("posted_at", { ascending: false }).limit(1).maybeSingle();
  const { count: callsToday } = await db.from("social_posts").select("id", { count: "exact", head: true }).not("model", "is", null).gte("created_at", dayStart);
  const cap = Math.min(settings.daily_cap, 6);
  const gapOk = !lastPost?.posted_at || Date.now() - new Date(lastPost.posted_at).getTime() >= settings.min_gap_minutes * 60_000;
  if (!dry) {
    if (inQuiet) return finish({ skipped: "quiet_hours" });
    if ((postedToday ?? 0) >= cap) return finish({ skipped: "daily_cap" });
    if (!gapOk) return finish({ skipped: "min_gap" });
  }
  let callsLeft = settings.max_model_calls_per_day - (callsToday ?? 0);
  if (callsLeft <= 0) return finish({ skipped: "model_call_cap" });

  const creds = loadTwitterCredentials();

  // Step 1: approved rows first. Expire anything 24h+ old.
  await db.from("social_posts").update({ status: "expired" }).eq("status", "approved").lt("created_at", new Date(Date.now() - DAY).toISOString());
  const { data: approved } = await db.from("social_posts").select("*").eq("status", "approved").order("created_at", { ascending: true }).limit(1);
  if (approved?.length && !dry) {
    const row = approved[0];
    const { data: art } = await db.from("articles").select(ARTICLE_COLS).eq("id", row.article_id).maybeSingle();
    const text = (row.edited_text ?? row.post_text ?? "").trim();
    if (!art || crimeGate(art).blocked) {
      await db.from("social_posts").update({ status: "held", reject_reason: "article missing or crime" }).eq("id", row.id);
      return finish({ step: "approved", result: "held_recheck_failed" });
    }
    const hc = runHouseChecks({ post: text, article: art, url: articleUrl(art), modelJson: row.model_output, recentTopicKeys: await recentTopics(db, row.id) });
    if (!hc.pass) {
      await db.from("social_posts").update({ status: "held", code_checks_json: hc.checks, reject_reason: `failed: ${failedChecks(hc.checks).join(",")}` }).eq("id", row.id);
      return finish({ step: "approved", result: "held_recheck_failed" });
    }
    const r = await doPost(db, row.id, text, articleUrl(art), art, settings.utm, creds);
    return finish({ step: "approved", result: r });
  }

  // Step 2: candidates.
  const since = new Date(Date.now() - settings.lookback_hours * 3600_000).toISOString();
  const { data: arts } = await db.from("articles").select(ARTICLE_COLS)
    .eq("is_published", true).eq("is_sponsored", false).eq("skip_auto_tweet", false)
    .gte("published_at", since).order("published_at", { ascending: false }).limit(60);
  const list = (arts || []) as any[];
  if (!list.length) return finish({ step: "candidates", result: "no_articles" });
  const { data: seen } = await db.from("social_posts").select("article_id").in("article_id", list.map((a) => a.id));
  const seenIds = new Set((seen || []).map((s: any) => s.article_id));

  const daySince = new Date(Date.now() - DAY).toISOString();
  const { data: posted24 } = await db.from("social_posts").select("article_id, topic_key").eq("status", "posted").gte("posted_at", daySince);
  const postedIds = (posted24 || []).map((p: any) => p.article_id).filter(Boolean);
  const { data: postedArts } = postedIds.length ? await db.from("articles").select("title").in("id", postedIds) : { data: [] };
  const postedTitles = (postedArts || []).map((p: any) => p.title as string);
  const topics24 = (posted24 || []).map((p: any) => p.topic_key).filter(Boolean) as string[];

  const base = (a: any) => ({ article_id: a.id, url: articleUrl(a), section: a.section, category_slug: a.category_slug, prompt_version: PROMPT_VERSION });
  const log = (r: unknown) => (summary.rows as unknown[]).push(r);
  const survivors: { a: any; score: number; keyword: boolean; kwReason: string }[] = [];

  for (const a of list) {
    if (seenIds.has(a.id)) continue;
    const cg = crimeGate(a);
    if (cg.blocked) {
      if (!dry) await db.from("social_posts").insert({ ...base(a), status: "rejected_crime", reject_reason: cg.reason });
      log({ id: a.id, status: "rejected_crime", reason: cg.reason });
      continue;
    }
    let dupReason = "";
    if (a.event_fingerprint) {
      const { data: ev } = await db.from("news_events").select("tweeted").eq("fingerprint", a.event_fingerprint).maybeSingle();
      if (ev?.tweeted) dupReason = "event already tweeted";
    }
    if (!dupReason && postedTitles.some((t) => headlineSimilarity(t, a.title) >= 0.55)) dupReason = "similar headline posted in last 24h";
    if (dupReason) {
      if (!dry) await db.from("social_posts").insert({ ...base(a), status: "rejected_duplicate", reject_reason: dupReason });
      log({ id: a.id, status: "rejected_duplicate", reason: dupReason });
      continue;
    }
    const gate = finalTweetValidator(a, { fingerprint: a.event_fingerprint || undefined });
    const v = validateStatisticalArticle(a);
    if (!gate.ok || !v.qualifies) {
      const reason = !gate.ok ? `${gate.code}: ${gate.reason}` : `${v.code}: ${v.reason}`;
      if (!dry) await db.from("social_posts").insert({ ...base(a), status: "rejected_ineligible", reject_reason: reason.slice(0, 500) });
      log({ id: a.id, status: "rejected_ineligible", reason });
      continue;
    }
    survivors.push({ a, score: v.score, keyword: cg.keyword_review, kwReason: cg.reason });
  }
  survivors.sort((x, y) => y.score - x.score);

  for (const c of survivors.slice(0, settings.max_candidates_per_run)) {
    if (callsLeft <= 0) { summary.stopped = "model_call_cap"; break; }
    const a = c.a;
    const url = articleUrl(a);
    const { data: src } = await db.rpc("get_article_source", { p_article_id: a.id });
    const userPayload = {
      title: a.title, section: a.section || a.category_slug, url, published_at: a.published_at, tags: a.tags || [],
      primary_source: Array.isArray(src) && src[0] ? src[0] : null,
      text: `${a.summary || ""}\n${stripHtml(a.body || "")}`.slice(0, 8000),
      topics_posted_last_24h: topics24,
    };
    let mj: any = null, promptTok = 0, complTok = 0, parseFail = false;
    try {
      for (let attempt = 0; attempt < 2 && !mj; attempt++) {
        callsLeft--;
        const r = await callGateway({
          model: settings.model, temperature: Number(settings.temperature), max_tokens: 800, json: true,
          messages: [{ role: "system", content: STATSGH_MASTER_PROMPT }, { role: "user", content: JSON.stringify(userPayload) }],
        });
        promptTok += r.prompt_tokens; complTok += r.completion_tokens;
        try { mj = parseJson(r.content); } catch { mj = null; }
      }
      parseFail = !mj;
    } catch (err) {
      if (err instanceof GatewayHaltError) { summary.halted = err.reason; break; }
      log({ id: a.id, error: (err as Error).message });
      continue;
    }

    const common = { ...base(a), model: settings.model, prompt_tokens: promptTok, completion_tokens: complTok, model_output: mj };
    if (parseFail) {
      if (!dry) await db.from("social_posts").insert({ ...common, status: "held", reject_reason: "json_parse_failed" });
      log({ id: a.id, status: "held", reason: "json_parse_failed" });
      continue;
    }
    const post = String(mj.post ?? "").trim();
    const fields = {
      ...common, topic_key: mj.topic_key ?? null, format: mj.format ?? null, post_text: post || null,
      char_count: weightedLength(post), key_number: mj.key_number ?? null, source: mj.source ?? null,
      chart_suggestion: mj.chart_suggestion ?? null, alt_text: mj.alt_text ?? null, checks_json: mj.checks ?? null,
    };
    if (mj.status === "REJECT") {
      if (!dry) await db.from("social_posts").insert({ ...fields, status: "rejected_model", reject_reason: String(mj.reason || "model reject").slice(0, 500) });
      log({ id: a.id, status: "rejected_model", reason: mj.reason });
      continue;
    }
    const hc = runHouseChecks({ post, article: a, url, modelJson: mj, recentTopicKeys: topics24 });
    const failed = failedChecks(hc.checks);
    const codeChecks = { ...hc.checks, _warnings: hc.warnings };
    let status = "held", reason = "";
    if (failed.length) reason = `failed: ${failed.join(",")}`;
    else if (c.keyword) reason = "crime_keyword_review";
    else if (settings.mode !== "auto" || dry) reason = dry ? "dry_run" : "review_only";
    else status = "post";

    if (dry) { log({ id: a.id, status: status === "post" ? "would_post" : "held", reason, post, checks: hc.checks }); continue; }

    const { data: ins, error: insErr } = await db.from("social_posts")
      .insert({ ...fields, code_checks_json: codeChecks, status: "held", reject_reason: reason || null }).select("id").single();
    if (insErr || !ins) { log({ id: a.id, error: insErr?.message }); continue; }
    if (status !== "post") { log({ id: a.id, status: "held", reason }); continue; }

    const r = await doPost(db, ins.id, post, url, a, settings.utm, creds);
    log({ id: a.id, status: r });
    break; // max one post per run (and stop on failure)
  }
  return finish({ step: "candidates", survivors: survivors.length });
});

async function recentTopics(db: any, excludeId?: string): Promise<string[]> {
  const { data } = await db.from("social_posts").select("id, topic_key").eq("status", "posted")
    .gte("posted_at", new Date(Date.now() - DAY).toISOString());
  return (data || []).filter((r: any) => r.id !== excludeId).map((r: any) => r.topic_key).filter(Boolean);
}

async function doPost(db: any, rowId: string, text: string, url: string, art: any, utm: string, creds: any): Promise<string> {
  if (!creds) {
    await db.from("social_posts").update({ status: "post_failed", reject_reason: "X credentials not configured" }).eq("id", rowId);
    return "post_failed";
  }
  const sep = url.includes("?") ? "&" : "?";
  const finalText = utm ? text.replace(url, `${url}${sep}${utm}`) : text;
  const res = await postTweet(finalText, creds);
  const now = new Date().toISOString();
  if (!res.ok) {
    await db.from("social_posts").update({ status: "post_failed", reject_reason: `x_api_${res.status}: ${JSON.stringify(res.raw).slice(0, 400)}` }).eq("id", rowId);
    return "post_failed";
  }
  await db.from("social_posts").update({ status: "posted", x_post_id: res.tweetId ?? null, posted_at: now }).eq("id", rowId);
  if (art?.event_fingerprint) {
    await db.from("news_events").update({ tweeted: true, tweeted_at: now, tweet_id: res.tweetId ?? null }).eq("fingerprint", art.event_fingerprint);
  }
  return "posted";
}
