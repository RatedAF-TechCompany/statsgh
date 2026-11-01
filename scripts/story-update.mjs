#!/usr/bin/env node
// Developing-story helper for site bots. Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env (never printed).
//   node scripts/story-update.mjs match '{"source_url":"https://...","story_key":"ecg|tariff-hike|ghana|2026-11","terms":["ECG","tariff","PURC"]}'
//   node scripts/story-update.mjs add   '{"article_id":"<uuid>","summary":"...","body_md":"...","sources":["https://..."],"kind":"update","is_material":true,"new_title":null,"new_summary":null}'
//   node scripts/story-update.mjs pending      # material updates not yet tweeted (+ article slug)
//   node scripts/story-update.mjs tweeted <update_id>
const [cmd, arg] = process.argv.slice(2);
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"); process.exit(2); }
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
async function call(path, init = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { ...h, ...(init.headers || {}) }, ...init });
  const t = await r.text();
  if (!r.ok) { console.error(`HTTP ${r.status}: ${t}`); process.exit(1); }
  return t ? JSON.parse(t) : null;
}
const a = arg ? JSON.parse(arg) : {};
let out;
if (cmd === "match") out = await call("rpc/find_story_match", { method: "POST", body: JSON.stringify({ p_source_url: a.source_url ?? null, p_story_key: a.story_key ?? null, p_terms: a.terms ?? [] }) });
else if (cmd === "add") out = await call("rpc/add_story_update", { method: "POST", body: JSON.stringify({
  p_article_id: a.article_id, p_summary: a.summary, p_body_md: a.body_md ?? null, p_sources: a.sources ?? [],
  p_kind: a.kind ?? "update", p_is_material: !!a.is_material, p_new_title: a.new_title ?? null, p_new_summary: a.new_summary ?? null }) });
else if (cmd === "pending") out = await call("story_updates?select=id,posted_at,summary,kind,article_id,articles(slug,title)&is_material=eq.true&tweeted_at=is.null&order=posted_at.asc");
else if (cmd === "tweeted") out = await call(`story_updates?id=eq.${encodeURIComponent(arg)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ tweeted_at: new Date().toISOString() }) });
else { console.error("usage: match|add|pending|tweeted"); process.exit(2); }
console.log(JSON.stringify(out, null, 2));
// match_type 'url' or 'story_key' => amend. 'terms' => ask a one-line AI yes/no ("Is <new item> the same story as <title>?") first.
