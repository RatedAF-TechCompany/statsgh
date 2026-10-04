# Homepage density and privacy fix

## Goal
Make the homepage compact and visually full at phone, tablet, and desktop widths without changing article, market-data, or publishing logic. Confirm that anonymous visitors cannot read stored email or contact records.

## Changes
- Rebuild the top-stories row so the lead image fills its column with a readable headline overlay, while the adjacent story list matches its height on desktop and stacks cleanly on smaller screens.
- Remove empty or oversized spacing and standardise homepage section gaps to 16–20px on mobile and 24–32px on desktop.
- Render article sections only when they contain stories, using a tight responsive card grid: one column on phones, two on tablets, and three or four on desktop.
- Add a compact “Key numbers today” strip after top stories using only stored sourced values that exist: Bank of Ghana rates, GSE index movement, and CPI.
- Add Markets, Business, and Crime & Justice homepage blocks from existing market snapshots and published articles; omit any block with no content.
- Align the header navigation, tickers, date strip, and homepage to the same content width and horizontal padding; keep navigation on one horizontally scrollable line where needed.
- Keep changes scoped to homepage presentation and shared header width behavior only.

## Validation
- Check the live homepage at 390px, 820px, and 1280px for overflow, dead space, image coverage, equal-height desktop top stories, and compact section rhythm.
- Capture one screenshot at each width and inspect the rendered result.
- Audit all public-schema tables containing email fields, including contact messages, newsletter subscriptions, and follows; verify RLS, grants, and policies prevent anonymous reads. Apply only the minimum database correction if any table is exposed.
- Confirm the project build succeeds after the edits.

## Final report
Report the completed homepage result, privacy audit, remaining credits, publish outcome, current Vercel deployment identifier/commit when available, screenshot paths, and an honest visual assessment.
