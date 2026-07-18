
# StatsGH Editorial Excellence — Implementation Plan

Budget target: keep monthly AI spend under $15/mo (down from £25 cap). All AI calls route through existing `ai-gateway.ts` with `GatewayHaltError` guard.

---

## Phase 1 — Foundation (Sources, Data, Entities)

### 1a. Primary source injection
Insert 5 new rows into `newsroom_sources`, marked `priority_tier = 1` and `is_primary_data = true` (new column):
- Bank of Ghana — Press Releases RSS
- Ghana Statistical Service — Publications feed
- Ghana Stock Exchange — Market announcements
- Ministry of Finance — Publications
- IMF Ghana Country Page

Add `is_primary_data BOOLEAN` column to `newsroom_sources` for fast-lane routing.

### 1b. Data-point extraction (piggyback, zero extra AI cost)
Extend the article-generation prompt in `newsroom-scan/index.ts` to also return a `key_data[]` array (label, value, unit, context). No new AI call — same completion.

Schema addition:
```sql
ALTER TABLE articles ADD COLUMN key_data JSONB DEFAULT '[]'::jsonb;
```

UI: New `KeyDataSidebar.tsx` rendered in `ArticleDetail.tsx`, right column.

### 1c. Named-entity graph
New tables:
- `entities` (id, name, slug, type: person|company|ministry|law|indicator, description, first_seen_at)
- `article_entities` (article_id, entity_id, mention_count)

Same generation prompt returns `entities[]`. Upsert to `entities` by slug, insert junction rows.

New route: `/entity/[slug]/page.tsx` — shows entity + all linked articles chronologically.

Search: extend existing `/search` to match entity names.

---

## Phase 2 — Speed (15-min lane + primary-source fast track)

### 2a. Revert cron to 15-min
```sql
SELECT cron.unschedule(12);
SELECT cron.schedule('newsroom-15min-scan', '*/15 * * * *', ...);
```
Keep tight batch filter + budget guard. Est. +$4/mo.

### 2b. Primary-source fast-lane (template, no AI)
In `newsroom-scan/index.ts`: if `source.is_primary_data === true`, skip the AI batch filter AND skip AI generation. Use a templated writeup:
> "The [source] published [title] on [date]. Key figures: [extracted data]. Full release: [link]."

Extract numbers via regex (`/(GHS|USD|%|billion|million|basis points)/i` + surrounding digits). Publishes in <5 min, zero AI cost.

Add `article_type` column: `'analysis' | 'primary_data' | 'expert'`.

---

## Phase 3 — Authority (Experts + BoG Scenarios)

### 3a. Expert auto-publish flow
New public route `/submit` with form: name, title, affiliation, article body, credentials link.

Extend `manual-article-submit` edge function:
- Accept `author_type='expert'`, `author_bio`, `author_affiliation`
- Auto-publish with `article_type='expert'` and forced tag `expert-commentary`
- Rate limit: 3 submissions per email per week (in-function check via `articles` table)
- Sanitize HTML (DOMPurify server-side, block scripts/iframes)
- Render `<ExpertBadge>` on article page

### 3b. Predictive scenarios function
New `supabase/functions/bog-rate-scenarios/index.ts`:
- Triggered by `bog-scan-cron` when a rate-change signal is detected
- Single AI call: `gemini-2.5-flash-lite`, max_tokens 400
- Prompt: "Given BoG's decision to [action] rates to [X]%, generate 3 numbered scenarios for the next 90 days: (1) if held, (2) if raised 100bps, (3) if cut 100bps. Focus on GHS, inflation, borrowing."
- Publishes as sidebar block on the source article via new `article_scenarios` JSONB column
- Est. cost: ~$0.02/event, ~5 events/month = $0.10

---

## Phase 4 — Distribution (Weekly Digest + Slack)

### 4a. Weekly email digest
New edge function `weekly-digest-email`:
- Runs Sundays 07:00 UTC via `pg_cron`
- Aggregates: top 5 articles by view_count (last 7 days) + new entities + new data points
- Uses existing Resend integration
- Sends to same subscriber list as daily newsletter

### 4b. Slack weekly digest
Requires **Slack App connector** (standard, workspace-owned — StatsGH posts to its own channel).

New edge function `weekly-digest-slack`:
- Runs Sundays 07:15 UTC
- Same aggregation as email
- Formatted as Slack blocks with article links
- Posts via `SLACK_API_KEY` gateway

I will call `standard_connectors--connect` for Slack after this plan is approved so you can pick your target channel.

---

## Technical details

### Files created
- `src/components/KeyDataSidebar.tsx`
- `src/components/ExpertBadge.tsx`
- `src/app/entity/[slug]/page.tsx`
- `src/app/submit/page.tsx`
- `supabase/functions/bog-rate-scenarios/index.ts`
- `supabase/functions/weekly-digest-email/index.ts`
- `supabase/functions/weekly-digest-slack/index.ts`

### Files modified
- `supabase/functions/newsroom-scan/index.ts` — extract key_data + entities in same prompt; fast-lane for primary sources
- `supabase/functions/manual-article-submit/index.ts` — expert flow
- `supabase/functions/bog-scan/index.ts` — trigger scenarios function on rate change
- `src/views/ArticleDetail.tsx` — render KeyDataSidebar, ExpertBadge, scenarios block
- `src/views/Search.tsx` — include entities

### DB migrations (one file)
1. `ALTER TABLE newsroom_sources ADD COLUMN is_primary_data BOOLEAN DEFAULT false`
2. `ALTER TABLE articles ADD COLUMN key_data JSONB DEFAULT '[]'`, `article_type TEXT DEFAULT 'analysis'`, `article_scenarios JSONB`
3. `CREATE TABLE entities (…)` + GRANTs + RLS (public read, service_role write)
4. `CREATE TABLE article_entities (…)` + GRANTs + RLS
5. Seed 5 primary sources into `newsroom_sources`

### Cron changes (via `supabase--insert`)
- Unschedule job 12; reschedule at `*/15 * * * *`
- Schedule `weekly-digest-email` Sun 07:00
- Schedule `weekly-digest-slack` Sun 07:15

### Cost projection (post-deployment)
| Item | Monthly |
|---|---|
| 15-min scan (tight filter) | ~$10 |
| Data + entity extraction (piggyback) | $0 |
| Primary-source fast-lane (templated) | $0 |
| Expert submissions | $0 (no AI) |
| BoG scenarios (~5/mo) | $0.10 |
| Weekly digest generation | $0.20 |
| **Total** | **~$10.30/mo** |

Within your £25 cap with ~£15 headroom for spikes.

### Order of execution
1. Migration (approval gate) → 2. Primary source seed → 3. Backend function edits (newsroom-scan, manual-submit, bog-scenarios) → 4. New digest functions → 5. Slack connector → 6. Frontend components/routes → 7. Cron updates → 8. Verify build.

Ready to execute on approval.
