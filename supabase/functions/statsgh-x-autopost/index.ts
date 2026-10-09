// THE ONLY StatsGH X autopost path.
// crime gate + duplicate gate + eligibility BEFORE the model -> master prompt ->
// code-side house checks -> review queue (social_posts) -> post (cap/gap/quiet hours).
// Kill switch: system_flags AUTO_TWEET_ENABLED. Defaults to review_only mode.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";
import { autoTweetEnabled } from "../_shared/auto-tweet-flag.ts";
import { callGateway, parseJson, GatewayHaltError } from "../_shared/ai-gateway.ts";
import { loadTwitterCredentials, postTweet, deleteTweet } from "../_shared/twitter-oauth.ts";
import { headlineSimilarity, validateStatisticalArticle } from "../_shared/statistical-validator.ts";
import { finalTweetValidator } from "../_shared/editorial-gate.ts";
import { crimeGate } from "../_shared/crime-gate.ts";
import { runHouseChecks, failedChecks, DOMAIN_LIKE_RE, REPLY_RE } from "../_shared/statsgh-house-checks.ts";
import { weightedLength } from "../_shared/x-text.ts";
import { STATSGH_MASTER_PROMPT, PROMPT_VERSION } from "../_shared/statsgh-master-prompt.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SITE = "https://www.statsgh.com";
const articleUrl = (a: any) => `${SITE}/${a.category_slug}/${a.slug}`;
const replyFor = (a: any) => `Read more: ${articleUrl(a)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function loadPrimarySource(db: any, articleId: string) {
  return (await db.rpc("get_article_source", { p_article_id: articleId })).data?.[0] ?? null;
}
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
    if (row.x_post_id && !row.x_post_deleted_at) return json({ error: "main post still live on X; delete it manually first" }, 409);
    const text = (body.edited_text ?? row.edited_text ?? row.post_text ?? "").trim();
    const recent = await recentTopics(db, row.id);
    const primarySource = await loadPrimarySource(db, art.id);
    const hc = runHouseChecks({ post: text, reply: replyFor(art), article: art, url: articleUrl(art), modelJson: row.model_output, primarySource, recentTopicKeys: recent });
    const failed = failedChecks(hc.checks);
    await db.from("social_posts").update({
      edited_text: body.edited_text ?? row.edited_text, code_checks_json: hc.checks, char_count: weightedLength(text),
      ...(failed.length ? { reject_reason: `failed: ${failed.join(",")}` } : { status: "approved", reviewed_by: auth.userId, reviewed_at: now, reply_text: replyFor(art), reply_status: null, link_mode: "first_reply" }),
    }).eq("id", row.id);
    if (failed.length) return json({ status: "held", failed, checks: hc.checks }, 422);
    return json({ status: "approved" });
  }

  /* ---------------- self-reply test (signed-in admin only; manual button only) ---------------- */
  if (action === "self_reply_test") {
    if (auth.via !== "admin_user" || !auth.userId) return json({ error: "Admin login required" }, 403);
    const { data: isAdm } = await db.from("user_roles").select("role").eq("user_id", auth.userId).eq("role", "admin").maybeSingle();
    if (!isAdm) return json({ error: "Admin login required" }, 403);
    const { count: recentTests } = await db.from("social_posts").select("id", { count: "exact", head: true })
      .eq("status", "test").gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((recentTests ?? 0) > 0) return json({ error: "A test ran in the last 60 seconds" }, 429);
    const testRow = {
      status: "test", article_id: null, model: null, url: "https://www.statsgh.com/",
      post_text: "StatsGH system test, please ignore. This post will be deleted shortly.",
      reply_text: "Read more: https://www.statsgh.com/", link_mode: "first_reply",
      reviewed_by: auth.userId, prompt_version: PROMPT_VERSION,
    };
    const tcreds = loadTwitterCredentials();
    if (!tcreds) {
      const { data: r0 } = await db.from("social_posts").insert({ ...testRow, reject_reason: "X credentials not configured" }).select("id").single();
      return json({ status: "test", ok: false, steps: [], row_id: r0?.id, result: "X credentials not configured" });
    }
    const { data: tr, error: trErr } = await db.from("social_posts").insert(testRow).select("id").single();
    if (trErr || !tr) return json({ error: trErr?.message }, 500);
    const steps: any[] = [];
    const save = (extra: Record<string, unknown> = {}) => db.from("social_posts").update({ x_steps: steps, ...extra }).eq("id", tr.id);
    const push = async (st: any) => { steps.push({ ...st, at: new Date().toISOString() }); await save(); };
    const errOf = (r: any) => (r.ok ? undefined : JSON.stringify(r.raw).slice(0, 400));

    const m = await postTweet(testRow.post_text, tcreds);
    await push({ step: "post_main", method: "POST", http_status: m.status, ok: m.ok, id: m.tweetId, error: errOf(m) });
    let replyId: string | undefined, replyOk = false, delReplyOk = false, delMainOk = false;
    if (m.ok && m.tweetId) {
      const r = await postTweet(testRow.reply_text, tcreds, { replyToId: m.tweetId });
      replyOk = r.ok && !!r.tweetId; replyId = r.tweetId;
      await push({ step: "reply", method: "POST", http_status: r.status, ok: r.ok, id: r.tweetId, error: errOf(r),
        ...(r.status === 403 ? { note: "403: possibly the Feb 2026 API reply restriction" } : {}) });
      if (replyId) {
        const d = await deleteTweet(replyId, tcreds); delReplyOk = d.ok;
        await push({ step: "delete_reply", method: "DELETE", http_status: d.status, ok: d.ok, id: replyId, error: errOf(d) });
      }
      const d2 = await deleteTweet(m.tweetId, tcreds); delMainOk = d2.ok;
      await push({ step: "delete_main", method: "DELETE", http_status: d2.status, ok: d2.ok, id: m.tweetId, error: errOf(d2) });
    }
    const st = (n: string) => steps.find((x) => x.step === n)?.http_status ?? "-";
    const summaryLine = `test: post ${st("post_main")}, reply ${st("reply")}, delete_reply ${st("delete_reply")}, delete_main ${st("delete_main")}`;
    await save({
      x_post_id: m.tweetId ?? null, reply_post_id: replyId ?? null,
      reply_status: replyId ? (delReplyOk ? "deleted" : "posted") : (m.ok ? "failed" : null),
      x_post_deleted_at: delMainOk ? new Date().toISOString() : null, reject_reason: summaryLine,
    });
    return json({ status: "test", ok: m.ok && replyOk && delReplyOk && delMainOk, steps, row_id: tr.id });
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
    const hc = runHouseChecks({ post: text, reply: replyFor(art), article: art, url: articleUrl(art), modelJson: row.model_output, primarySource: await loadPrimarySource(db, art.id), recentTopicKeys: await recentTopics(db, row.id) });
    if (!hc.pass) {
      await db.from("social_posts").update({ status: "held", code_checks_json: hc.checks, reject_reason: `failed: ${failedChecks(hc.checks).join(",")}` }).eq("id", row.id);
      return finish({ step: "approved", result: "held_recheck_failed" });
    }
    const r = await doPost(db, row.id, text, replyFor(art), art, creds);
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
    const primarySource = await loadPrimarySource(db, a.id);
    const userPayload = {
      title: a.title, section: a.section || a.category_slug, url, published_at: a.published_at, tags: a.tags || [],
      primary_source: primarySource,
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
      chart_suggestion: mj.image_suggestion ?? mj.chart_suggestion ?? null, reply_text: replyFor(a), link_mode: "first_reply", alt_text: mj.alt_text ?? null, checks_json: mj.checks ?? null,
    };
    if (mj.status === "REJECT") {
      if (!dry) await db.from("social_posts").insert({ ...fields, status: "rejected_model", reject_reason: String(mj.reason || "model reject").slice(0, 500) });
      log({ id: a.id, status: "rejected_model", reason: mj.reason });
      continue;
    }
    const hc = runHouseChecks({ post, reply: replyFor(a), article: a, url, modelJson: mj, primarySource, recentTopicKeys: topics24 });
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

    const r = await doPost(db, ins.id, post, replyFor(a), a, creds);
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

async function doPost(db: any, rowId: string, post: string, replyText: string, art: any, creds: any): Promise<string> {
  if (!creds) {
    await db.from("social_posts").update({ status: "post_failed", reject_reason: "X credentials not configured" }).eq("id", rowId);
    return "post_failed";
  }
  if (DOMAIN_LIKE_RE.test(post) || !REPLY_RE.test(replyText)) {
    await db.from("social_posts").update({ status: "held", reject_reason: "pre_post_assert_failed" }).eq("id", rowId);
    return "held";
  }
  const steps: any[] = [];
  const step = (name: string, method: string, r: any, id?: string) =>
    steps.push({ step: name, method, http_status: r.status, ok: r.ok, id, error: r.ok ? undefined : JSON.stringify(r.raw).slice(0, 400), at: new Date().toISOString() });

  const main = await postTweet(post, creds);
  step("post_main", "POST", main, main.tweetId);
  if (!main.ok || !main.tweetId) {
    await db.from("social_posts").update({ status: "post_failed", x_steps: steps, reject_reason: `x_api_${main.status}: ${JSON.stringify(main.raw).slice(0, 400)}` }).eq("id", rowId);
    return "post_failed";
  }
  const mainId = main.tweetId;
  await db.from("social_posts").update({ x_post_id: mainId, reply_status: "pending", x_steps: steps }).eq("id", rowId);

  let reply: any = null;
  const waits = [0, 2000, 6000];
  for (let i = 0; i < 3; i++) {
    if (waits[i]) await sleep(waits[i]);
    reply = await postTweet(replyText, creds, { replyToId: mainId });
    step(`reply_attempt_${i + 1}`, "POST", reply, reply.tweetId);
    if (reply.ok && reply.tweetId) break;
  }
  const now = new Date().toISOString();
  if (reply?.ok && reply.tweetId) {
    await db.from("social_posts").update({
      status: "posted", posted_at: now, reply_post_id: reply.tweetId, reply_status: "posted", x_steps: steps,
    }).eq("id", rowId);
    if (art?.event_fingerprint) {
      await db.from("news_events").update({ tweeted: true, tweeted_at: now, tweet_id: mainId }).eq("fingerprint", art.event_fingerprint);
    }
    return "posted";
  }

  let del = await deleteTweet(mainId, creds);
  step("delete_main", "DELETE", del, mainId);
  if (!del.ok) {
    await sleep(2000);
    del = await deleteTweet(mainId, creds);
    step("delete_main_retry", "DELETE", del, mainId);
  }
  const replyId = reply?.tweetId ?? null;
  const reason = del.ok
    ? `reply_failed (main ${mainId} deleted; reply ${replyId ?? "none"}; last reply HTTP ${reply?.status})`
    : `reply_failed; main_post_delete_failed (main ${mainId} STILL LIVE: delete manually; reply ${replyId ?? "none"})`;
  console.error(`statsgh-x-autopost reply_failed main=${mainId} reply=${replyId ?? "none"} deleted=${del.ok}`);
  await db.from("social_posts").update({
    status: "held", reply_status: "failed", posted_at: null, x_post_id: mainId, reply_post_id: replyId,
    x_post_deleted_at: del.ok ? new Date().toISOString() : null, reject_reason: reason, x_steps: steps,
  }).eq("id", rowId);
  return "reply_failed";
}
