# StatsGH Efficient Twitter Pipeline

One unified pipeline replaces every existing tweet function. Three stages, five new tables, three cron jobs.

## 1. Database migration (single call)

Create these tables in `public` with GRANTs + RLS (admin read, service_role full):

- `articles_rejected_scoring` — `article_id`, `headline`, `score int`, `reason text`, `rejected_at timestamptz default now()`
- `articles_rejected_ai` — `article_id`, `reason text`, `rejected_at timestamptz default now()`
- `tweet_queue` — `id uuid pk`, `article_id uuid` (unique), `tweet_text text`, `url text`, `generated_at timestamptz default now()`, `scheduled_hour int`, `posted bool default false`, `posted_at timestamptz`, `twitter_id text`, `halt_reason text`
- `tweet_schedule_log` — `id uuid pk`, `queue_id uuid`, `article_id uuid`, `twitter_id text`, `posted_at timestamptz`, `impressions_24h int`
- `daily_twitter_metrics` — `day date pk`, `articles_published int`, `articles_passed_keyword_gate int`, `articles_rejected_at_keyword int`, `articles_rejected_at_ai int`, `tweets_generated int`, `tweets_posted int`, `avg_engagement numeric`, `total_cost_daily numeric`

## 2. Shared scoring library

`supabase/functions/_shared/tweet-scoring.ts` — pure TS module with tier-1 and tier-2 keyword sets and a `scoreArticle(title, summary)` function returning `{score, hits}`. Threshold constant `TWEET_KEYWORD_THRESHOLD = 3` (adjustable in one place).

## 3. Stage 1 — keyword gate

Wire into `supabase/functions/newsroom-scan/index.ts` immediately after an article is published: call `scoreArticle`. If `score >= 3`, do nothing (article stays eligible). If `score < 3`, insert into `articles_rejected_scoring`. Zero AI cost.

## 4. Stage 2 — batch tweet generator

New function `supabase/functions/tweet-batch-generator/index.ts` (`verify_jwt = false`):

- Load published articles from the last 6h whose `id` is NOT in `tweet_queue` and NOT in `articles_rejected_scoring` and NOT in `articles_rejected_ai`.
- Cap at 10.
- One `callGatewayJson` call to `google/gemini-2.5-flash-lite`, `max_tokens: 800`, `temperature: 0.2`, JSON mode, with the batch prompt.
- For each returned `{article_id, tweet, reject_reason}`: null tweet → `articles_rejected_ai`; otherwise append `[Read: {url}]` if missing, clamp to 280 chars, insert into `tweet_queue`.
- On `GatewayHaltError` return early with halt reason.

Cron via `pg_cron` at `0 0,6,12,18 * * *`.

## 5. Stage 3 — hourly poster

New function `supabase/functions/tweet-hourly-poster/index.ts` (`verify_jwt = false`):

- Select the oldest `tweet_queue` row with `posted = false AND halt_reason IS NULL`.
- Post to X v2 `POST /2/tweets` using OAuth 1.0a with the existing `TWITTER_*` secrets (reuse the signing helper already in `daily-batch-tweet-filter` / `hourly-tweet-poster`).
- On success: update row `posted=true, posted_at=now(), twitter_id`, insert into `tweet_schedule_log`.
- On 402/429 or network fail: set `halt_reason`, return.

Cron via `pg_cron` at `5 * * * *`.

## 6. Daily metrics rollup

New function `supabase/functions/tweet-metrics-rollup/index.ts`, cron `10 0 * * *`:

- Compute yesterday's counts across the five tables and upsert into `daily_twitter_metrics`.

## 7. Retire old functions

- Unschedule pg_cron jobs for `scheduled-tweet-poster`, `hourly-tweet-statsgh`, `hourly-tweet-scheduler`, `daily-batch-tweet-filter`, `hourly-tweet-poster`, `tweet-article`.
- Leave source files in place (do not delete) so history/logs remain accessible; note in code header they are deprecated.
- Add `[functions.tweet-batch-generator]`, `[functions.tweet-hourly-poster]`, `[functions.tweet-metrics-rollup]` blocks with `verify_jwt = false` in `supabase/config.toml`.

## Technical notes

- Article URL: `https://statsgh.com/{category_slug}/{slug}/` (matches `daily-batch-tweet-filter`).
- All AI calls route through `_shared/ai-gateway.ts` (`callGatewayJson`, `GatewayHaltError`) — no direct fetches.
- RLS: all five tables — `authenticated` gets `SELECT` only when `public.has_role(auth.uid(),'admin')`; `service_role` gets `ALL`. No `anon` grants.
- `tweet_queue.article_id` is unique so re-runs of the batcher are idempotent.
- `statsgh-tweet-validator-v2` from the last turn stays available for ad-hoc admin use but is not on the cron path.

## Confirmation

Reply "go" to apply the migration and ship the three functions. I will disable the old cron jobs in the same migration.