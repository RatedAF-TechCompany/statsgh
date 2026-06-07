This is ~3 weeks of work compressed into one prompt. Shipping all 12 in a single deployment guarantees half-broken features (especially newsletter sending, sponsored content, calculators, and company profiles all need careful schema + RLS + edge-function wiring). I want to split it into 4 focused phases so each ships working, and confirm a few decisions before I build.

## Decisions I need from you first

1. **Newsletter sender domain**: `no-reply@statsgh.com` requires `statsgh.com` (or a subdomain) verified in Resend. Is it already verified? If not, I'll use `onboarding@resend.dev` until you verify, OR use Lovable's built-in email system (recommended — handles DNS, queue, retries, unsubscribe, suppression automatically).
2. **GSE company list accuracy**: Several tickers in your list are wrong for GSE (Zenith Bank Ghana isn't listed; "Tullow Oil Ghana" trades as TLW on LSE not GSE; MTN Ghana ticker is `MTNGH`; Cocoa Processing is `CPC`). I'll use only verified GSE-listed tickers from the existing `gse_stocks` table — OK?
3. **RSS feeds**: Most of the gov.gh URLs you listed (bog.gov.gh/feed, gra.gov.gh/feed, mofep.gov.gh/feed, sec.gov.gh/feed, statsghana.gov.gh/feed, purc.com.gh/feed, npa.gov.gh/feed, mincom.gov.gh/feed, cocobod.gh/feed, gipcghana.com/feed) **do not expose RSS feeds** — I checked previously and most return 404. I'll add only those that actually work and create a scraper-based source for the rest where the site is scrapable. OK?
4. **Tax calculator bands**: I'll use the current 2025 PAYE bands published by GRA. OK to hardcode and add a "last updated" note?

## Phased rollout

### Phase 1 — Editorial depth (ship first)
- Add `Financial Literacy` and `Analysis` sections to nav + section mapping
- Update `newsroom-scan` AI prompt to generate 1 financial-literacy explainer/day and 1 analysis piece/day
- Add `ANALYSIS` teal tag rendering on article cards
- Add `photo_url` column to `journalists`, backfill DiceBear avatars, render 32px avatar next to bylines
- Add Most Read right rail (we already have `MostReadRail.tsx` — wire it into homepage above Ghana At A Glance)
- Add verified working RSS sources only

### Phase 2 — Markets & Companies
- `/markets/gse` page: index hero number, full sortable stocks table, top gainers/losers, 30-day index chart
- `/companies/:ticker` profile pages for tickers actually present in `gse_stocks`
- Link from Markets & Data nav and Ghana At A Glance

### Phase 3 — Tools & Monetization infra
- `/tools/calculator` with 4 tabs (PAYE, T-bill, GSE return, Cedi inflation)
- `sponsored_content` table + RLS + admin CRUD + homepage "PARTNER CONTENT" rail
- `/podcast` page + homepage podcast card; auto-surface articles with `audio_url`

### Phase 4 — Newsletter system
- `subscribers` table + RLS
- `subscribe-email` edge function (validation, insert, welcome email)
- Footer signup form + 30-second delayed modal
- `send-daily-newsletter` cron at 07:00 UTC (top 5 articles last 24h)
- Wire the masthead "Subscribe" button to the modal
- (Strong recommendation: use Lovable Emails, not raw Resend — same result, far better deliverability and retry safety)

## Why phased, not single deployment
- Newsletter alone needs domain verification, queue infra, unsubscribe page, and suppression handling. Bundled with 11 other features it WILL ship broken.
- Calculator + Company profiles + GSE page are all new routes with their own data shapes — easier to QA in isolation.
- Each phase ships visibly to the user; you can course-correct between them.

**Reply with answers to the 4 questions above and I'll start Phase 1 immediately.**