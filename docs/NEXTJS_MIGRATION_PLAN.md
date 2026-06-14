# Migrate StatsGH to Next.js (SSR) on a Branch → Verify → Merge to main

## Context

StatsGH article pages are a client-side React SPA: content loads *after* the page reaches the browser, so preview bots (WhatsApp/X/Facebook) and search crawlers see an empty shell — no headline, no image, poor indexing. The chosen fix is the structural one: rebuild on **Next.js with server-side rendering**, so the full article HTML (and metadata) is produced on the server and every client — human or bot — gets complete content on the first response.

Workflow agreed with the user: **cut a new branch, perform the migration there, fully verify it behaves as intended, then merge to `main`.**

---
little change

## Decisive Discovery: a proven blueprint already exists

- A remote branch `origin/nextjs-migration` (tip `5078f4c "0.1.0"`, dated **2026-02-04**) contains a **complete, well-built Next.js App Router migration**.
- Its article route `src/app/[categorySlug]/[articleSlug]/page.tsx` is a clean reference implementation: server-side data fetch via `createReadOnlyServerClient` (`src/lib/supabase/server`), a full `generateMetadata()` (canonical, OpenGraph, Twitter, robots, Google-News keywords), server-rendered JSON-LD `NewsArticle`, server-side category-mismatch `redirect()`, and a server/client split (`page.tsx` server shell + `ArticleContent.tsx` client component for interactivity).
- It already used `@supabase/ssr` for cookie-based server auth and configured `next.config.mjs` `images.remotePatterns` for `statsgh.com` and the Supabase storage host.

**But it cannot be merged forward.** `origin/nextjs-migration` is an *ancestor* of `main`; `main` is **438 commits ahead** (Feb 4 → Jun 13) with **111 src files changed (+5,634 / −4,563), 29 components, 36 pages, 20 edge-function changes**, and the app was reverted back to Vite afterward. The blueprint is 4 months stale.

**Strategy:** branch off **current `main`** and re-apply the migration, using `5078f4c` as a proven structural template — porting *today's* Vite components/pages into the App Router layout the blueprint already worked out. This is a port, not a from-scratch design.

---

## Critical operational decision (flag to owner before starting)

**Lovable.dev cannot host Next.js SSR.** Migrating means **leaving Lovable and deploying on Vercel.** After this, the team edits code + git + Vercel instead of Lovable's visual editor. This is almost certainly why the Feb attempt was reverted. The whole team must accept this change of workflow before we merge to `main`. Supabase (DB + all 31 edge functions) is unaffected — it stays exactly as-is.

---

## Branch & Workflow

```
git checkout main && git pull
git checkout -b nextjs-ssr            # fresh branch off current main
# ... migration work ...
# verify locally + on a Vercel preview deploy
# only after sign-off: merge nextjs-ssr → main
```
Keep `origin/nextjs-migration` available for reference (`git show 5078f4c:<path>`); do not merge it.

---

## Migration Steps

1. **Tooling & deps** — add `next`, `@supabase/ssr`; add `next.config.mjs` (copy blueprint's `images.remotePatterns`); set `scripts` (`dev`/`build`/`start` → next, keep `*:vite` fallbacks as the blueprint did); add `.next/` to `.gitignore`. Keep Tailwind/shadcn/TipTap/React Query as-is.

2. **App Router skeleton** — create `src/app/layout.tsx`, `providers.tsx` (React Query + Tooltip client providers), `globals.css`, `not-found.tsx`. Mirror the blueprint's structure.

3. **Supabase server client** — add `src/lib/supabase/server.ts` (`createReadOnlyServerClient`) and keep the existing browser client for client components. Port from blueprint.

4. **Public pages → server components** (the SEO-critical part). For each, server-fetch + `generateMetadata()`, delegate interactivity to a `"use client"` child:
   - `src/app/[categorySlug]/[articleSlug]/page.tsx` (+ `ArticleContent.tsx`, `not-found.tsx`) — **the core fix**; base on blueprint, repopulate from current `src/pages/ArticleDetail.tsx`.
   - `src/app/[categorySlug]/page.tsx` (+ `CategoryContent.tsx`) — from current `src/pages/Category.tsx`.
   - Home `src/app/page.tsx`, `news/`, `topics/[slug]`, `data/[slug]`, `dashboards/*`, `sources`, `search`, `saved`, `auth`, `verify-comment`.

5. **Route handlers** — `src/app/sitemap.ts`, `src/app/news-sitemap.xml/route.ts`, `src/app/api/track-view/route.ts` (move client-side view tracking server-side). Blueprint has all three.

6. **Routing & redirects** — translate the `src/App.tsx` route table (incl. legacy `/category/*`, `/article/*`, old→new category redirects) into App Router folders + `redirect()`/`next.config` redirects. **Fix the lossy ones while porting:** `/article/:slug` should resolve to the real article (server lookup → redirect), not dump to `/top-stories`.

7. **Admin dashboard (`/admin/*`, ~36 pages)** — largest surface but lowest SEO stakes. Render as client components (`"use client"`) behind a server auth gate using `@supabase/ssr`. The existing TipTap editor, publish/schedule, media, analytics, users, audit log all carry over with minimal logic change.

8. **Auth** — replace SPA session checks with `@supabase/ssr` cookie-based sessions so server components and the admin gate read auth correctly.

9. **Reconcile 4-month drift** — for every ported file, take the **current `main`** version of the component as source of truth (newer design/features), not the Feb blueprint. The blueprint supplies *structure*; main supplies *content*.

10. **Decommission workarounds (post-merge)** — once SSR is live, the `article-reader`/`article-meta` edge functions and any Cloudflare bot-routing become redundant. Keep `article-reader` as a harmless fallback or update `robots.txt` to drop the note. No rush.

---

## Hosting cutover (Vercel)

- Create a Vercel project from the repo; set env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_*` keys, service-role key for server routes).
- Use **Vercel preview deployments** for verification before touching DNS.
- Final cutover: point `statsgh.com` DNS at Vercel. Reversible.
- Supabase edge functions and cron `.github/workflows` are independent — no change.

---

## Verification (before merge to main)

- `curl -s -A "Twitterbot" "<preview-url>/<cat>/<slug>"` → returns full article HTML + OG/Twitter/canonical tags (the original bug, fixed).
- `curl -s "<preview-url>/<cat>/<slug>" | grep -i og:title` → headline present in raw HTML (no JS executed).
- Facebook Sharing Debugger + X Card Validator on a preview URL → preview card renders.
- View-source on an article → JSON-LD `NewsArticle` present.
- Admin: log in, write + publish + schedule an article, upload media — all work behind auth.
- Click-through of legacy URLs (`/article/<slug>`, old category slugs) → land on correct pages, not homepage/listing.
- Run `next build` clean; smoke-test every top-level route.
- Confirm humans get the full interactive site (client hydration works: bookmarks, comments, share).

---

## Risks / Watch-items

- **Lovable workflow ends** — biggest org change; confirm team buy-in (see above).
- **Drift reconciliation** is the bulk of the effort — 36 pages / 29 components changed since the blueprint; each must be re-ported from current main, not copied from Feb.
- **Auth correctness** under `@supabase/ssr` (server vs client session) — test admin thoroughly.
- **Env vars / service-role key** must be set in Vercel or server routes 500.
- Do all of this on `nextjs-ssr`; merge to `main` only after the full verification checklist passes.
