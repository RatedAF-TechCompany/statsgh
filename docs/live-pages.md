# Live coverage pages

BBC-style live blogs at `/live/<slug>-YYYY-MM-DD`, with an index at `/live`.

This is prepared so going live is **one migration + one approved Worker deploy**. Do not apply the migration to production or deploy until Zeb confirms.

## Command format

Secrets come from the environment only (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `REVALIDATE_SECRET` and `SITE_ORIGIN`). They are never written to the repo.

Local preview (no Supabase): `LIVE_PAGES_ADAPTER=file` and optional `LIVE_PAGES_STORE` (JSON file path).

```bash
# LIVE START <slug>
npx tsx scripts/live.ts START boad-review \
  --headline "BOAD board meets in Accra to review the lending pipeline" \
  --byline "Abubakar Saddique" \
  --bullets "The board is meeting in Accra today | Officials have not published a communiqué | A follow-up briefing is expected this evening" \
  --title "The meeting has opened in Accra" \
  --body "The West African Development Bank board has opened its meeting in Accra. Officials said a communiqué would follow."

# LIVE ADD <slug>
npx tsx scripts/live.ts ADD boad-review \
  --title "Ministers arrive at the venue" \
  --body "Finance ministry officials have arrived at the meeting venue." \
  --source "https://www.example.com/briefing"

# LIVE SUMMARY <slug>
npx tsx scripts/live.ts SUMMARY boad-review \
  --bullets "The board is meeting in Accra today | A communiqué is now expected after 17:00 GMT | No lending figures have been published yet"

# LIVE EDIT <slug> <entry-id>
npx tsx scripts/live.ts EDIT boad-review 11111111-1111-1111-1111-111111111111 \
  --title "Ministers have arrived at the venue" \
  --body "Finance ministry officials arrived shortly after 14:00 GMT."

# LIVE END <slug>
npx tsx scripts/live.ts END boad-review \
  --title "The meeting has closed" \
  --body "The board has closed its meeting. A short communiqué is expected later this evening."
```

Headlines and entry titles must not contain a colon. Summary boxes need 3–5 bullets. The URL for a page started on 13 November 2026 is:

`https://www.statsgh.com/live/boad-review-2026-11-13`

Add `--hidden` on START for a noindex preview (excluded from `/live`, the homepage banner, and sitemaps).

## Go-live (needs Zeb's confirmation)

1. Apply `supabase/migrations/20261113230000_live_pages.sql` to the production Ghana-news Supabase project (schema `public` only).
2. Deploy the Worker from this branch (or from main after a reviewed merge). Rollback target is the previously live Worker version (`npx wrangler rollback`). The migration is additive; a Worker rollback leaves the new tables unused.
