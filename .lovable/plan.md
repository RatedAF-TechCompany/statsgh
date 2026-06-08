## GSC Indexing Fix Plan

After reading the codebase, most of what GSC reports is **expected for a SPA** but a few items are real bugs. Here's what to change and why.

### 1. Noindex pages (34) — keep, but stop Google from queuing them

Only six files use `noindex`: `Auth`, `Search`, `Saved`, `Dashboard`, `Admin`, `VerifyComment`. The 34 count comes from admin sub-routes (`/admin/articles`, `/admin/users`, etc.) all rendering through the SPA shell. These **should stay noindex** — they're private surfaces.

Fix: make sure Google stops re-crawling them.
- Add the missing admin sub-paths to `public/robots.txt` `Disallow:` list so Googlebot stops fetching them at all (currently only `/admin` and `/admin/*` are listed — good — but `/dashboard`, `/saved`, `/search`, `/auth`, `/verify-comment` need to stay).
- Audit the app for any internal `<Link>` pointing into admin/auth/dashboard surfaces from public pages; remove or hide them behind an auth gate so they don't seed Google's queue.
- Mark these GSC rows as "Validate Fix" once robots.txt update ships — they'll drop off over time.

### 2. Soft 404 (20) — real bug, dynamic routes render 200 with no data

Three dynamic routes are guilty:

**a) `/article-reader` edge function** — already returns proper 404 for missing slugs. No change.

**b) `src/pages/ArticleDetail.tsx`** — when the slug doesn't match a published article, `article` is `null` but the page still renders the layout shell. Fix: when `!isLoading && !article`, render `<NotFound />` instead of the article shell. Also add `<meta name="robots" content="noindex">` via `usePageMeta` in that branch so any cached 200 response is at least de-indexed.

**c) `src/pages/IndicatorDetail.tsx`** — uses `.single()` which throws on missing rows and currently shows broken UI / skeletons forever. Switch to `.maybeSingle()` and render `<NotFound />` when the row is missing (same `noindex` pattern as ArticleDetail).

**d) `src/pages/Category.tsx`** — the catch-all `/:categorySlug` route matches any single-segment URL. If the slug isn't a known section, `categorySlugs` is `[]` and the page renders a blank state with 200. Fix: when `getCategoriesForSection(categoryParam)` returns an empty array, render `<NotFound />` with `noindex`.

### 3. Hard 404 (19) — needs the GSC URL list

We can't see which URLs Google has cached as 404 without the export. Two paths forward:

- **You export the list** from GSC → Pages → Not found → Export. Paste it and I'll add a tiny redirect map (legacy slugs → current slugs) inside `App.tsx` using `<Navigate to=... replace />` routes, or — if the slug pattern is consistent — a single redirect rule.
- Without the export, I can pre-emptively add redirects for any old-pattern URLs I find in git history / sitemap diffs, but coverage will be partial.

Recommend the first option — quicker and complete.

### 4. Page with redirect (3) — likely `/article/:slug` legacy route

`App.tsx` keeps the legacy `<Route path="/article/:slug" element={<ArticleDetail />} />`. `ArticleDetail` then client-side `navigate(... , { replace: true })` to the new `/:categorySlug/:articleSlug` form. Google sees this as "Page with redirect" and doesn't index the legacy URL — that's correct behaviour.

Fix:
- Make sure the **sitemap** never emits `/article/:slug` URLs (verify `main-sitemap` and `news-sitemap` edge functions emit only `/{category_slug}/{slug}`).
- Grep the codebase for any internal `<Link to="/article/...">` and rewrite to the canonical form.
- Keep the route itself so external inbound links still work — that's by design.

### 5. Alternate page with proper canonical — leave alone

These are exactly what the canonical tag is for. `CanonicalManager` already self-references the current path; `ArticleDetail` redirects mismatched category slugs to the canonical one. No change.

### 6. Crawled — currently not indexed — content depth

Low priority and out of scope for a code change. The fix is editorial: longer articles, fewer near-duplicate thin pieces. I'll skip this in the implementation.

---

### Technical changes (when you switch to build mode)

| File | Change |
| --- | --- |
| `src/pages/ArticleDetail.tsx` | Early return `<NotFound />` + `noindex` when `!isLoading && !article` |
| `src/pages/IndicatorDetail.tsx` | `.single()` → `.maybeSingle()`; early return `<NotFound />` + `noindex` when no row |
| `src/pages/Category.tsx` | Early return `<NotFound />` + `noindex` when `categorySlugs.length === 0` |
| `src/pages/NotFound.tsx` | Add `usePageMeta({ robots: "noindex" })` so the 404 page never gets indexed |
| `public/robots.txt` | Verify all private paths listed; no other changes needed |
| `src/App.tsx` | (Pending your GSC export) add `<Route path="/old-path" element={<Navigate to="/new" replace />} />` entries for hard-404 URLs |
| Grep pass | Remove any internal `<Link to="/article/...">` in favour of category-prefixed URLs |
| Sitemap edge functions | Verify they emit only canonical URL form (already do per memory, but re-check) |

### What you need to provide

1. **The "Not found" URL list** from GSC (Indexing → Pages → click "Not found" → Export). Without it the 19 hard-404s stay broken.
2. Confirm the 6 noindex pages (`Auth`, `Search`, `Saved`, `Dashboard`, `Admin`, `VerifyComment`) should stay private — I'll assume yes unless told otherwise.

Ready for build mode whenever you give the go-ahead.
