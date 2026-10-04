# StatsGH scheduled jobs

All times UTC (Africa/Accra is UTC+0). No secrets are recorded here.

## The 15-minute publishing trigger (identified)

The 15-minute publishing cadence comes from the **pg_cron job `newsroom-15min-scan`**
(`*/15 * * * *`), which calls the `newsroom-scan` function directly.
Any change to publishing cadence must be documented here.

> Security: this job sends `Authorization: Bearer <scheduler token>` built at run time by
> `private.scheduler_headers()` (token stored in `private.scheduler_auth`, not in any
> migration). `newsroom-scan` and `newsroom-scheduled` reject callers without a valid
> token, service role key, `CRON_SECRET` or admin/editor login (401).

## GitHub Actions workflows (`.github/workflows/`)

| Workflow | Schedule | Calls | Why |
|---|---|---|---|
| `newsroom-cron.yml` | `0 0,6,12,18 * * *` | `newsroom-scheduled` (Bearer `CRON_SECRET` repo secret) | Backup newsroom trigger; function returns 202 and scans in background |
| `market-newsletter-cron.yml` (market job) | `0 */6 * * *` | `market-data-refresh` | Backup market refresh every 6 hours |
| `market-newsletter-cron.yml` (newsletter job) | `0 6 * * *` | `daily-newsletter` | Daily newsletter |
| `bog-scan-cron.yml` | `30 */12 * * *` | `bog-dashboard-scan` | Bank of Ghana signal scan |
| `backfill-images-cron.yml` | `0 3 * * *` | `backfill-images` | Fill missing hero images |

## Active pg_cron jobs (queried from `cron.job`, 4 Oct 2026)

| Job | Schedule | Notes |
|---|---|---|
| compile-week-in-numbers | `0 21 * * 0` | SQL: weekly Week in Numbers |
| daily-homepage-refresh-6am | `0 6 * * *` | daily-homepage-refresh function |
| editorial-metrics-rollup-job | `20 0 * * *` | editorial-metrics-rollup function |
| editorial-tier1-job | `0 * * * *` | editorial-tier1 function |
| editorial-tier2-batch-job | `0 */6 * * *` | editorial-tier2-batch function |
| expire-breaking-news-tags | `*/30 * * * *` | SQL: clears breaking flag after 2h |
| market-data-refresh-hourly | `5 * * * *` | market-data-refresh function (primary) |
| monthly-data-refresh | `0 6 1 * *` | data-refresh function |
| **newsroom-15min-scan** | `*/15 * * * *` | **NEWSROOM — active**; calls newsroom-scan |
| pipeline-watchdog-30min | `*/30 * * * *` | pipeline-watchdog → pipeline_health row |
| publish-scheduled-articles | `*/5 * * * *` | SQL: publishes due scheduled articles |
| refresh-crime-stats | `45 6 * * *` | SQL: crime tracker |
| refresh-inflation-readings | `30 6 * * *` | SQL: inflation tracker |
| source-health-check-6h | `0 */6 * * *` | source-health-check function |
| statsgh-weekly-digest | `0 6 * * 1` | weekly-digest function (stores digest; no tweets) |

Tweet jobs are unscheduled (`AUTO_TWEET_ENABLED=false`).

## Watchdog

`pipeline-watchdog` writes a `pipeline_health` row every 30 minutes: hours since the
last published article (status `stale` when > 6 h between 06:00 and 23:00 Accra) and
`runs_failing` when the last 3 `newsroom_runs` failed. Shown on `/dashboard`. No alerts are sent.

## Open items

- Set `CRON_SECRET` (edge function secret and GitHub repository secret, same value).
- The retired token remains in git history; it no longer works (`newsroom-scheduled` returns 401 for it).

## Bank of Ghana scrapers (added Oct 2026)
| Job | Schedule (UTC) | Calls | Why |
|---|---|---|---|
| `bog-fx-twice-daily` | `30 10,16 * * 1-5` | `bog-rates-scrape?job=fx` | Official BoG daily interbank FX rates, twice per business day |
| `bog-rates-daily` | `15 7 * * *` | `bog-rates-scrape?job=tbills,policy,interbank` | T-bill auctions, policy rate history, interbank rate |

Both authenticate with `private.scheduler_headers()`. Each run is logged in `market_scrape_runs`.

## GSE end-of-day snapshots
- `gse-eod-twice-daily` — pg_cron `30 15,17 * * 1-5` (UTC = Accra): calls `gse-scrape?job=daily` with `private.scheduler_headers()`. Stores the latest GSE trading day into `gse_daily_prices` and `gse_index_daily`.
- `compile-week-in-numbers` (Sunday 21:00) now also runs `compile_gse_week()` for the "GSE week" section (needs ≥2 trading days).
