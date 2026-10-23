# Roadmap

- [x] Raise newsroom writing budgets to 6000 per attempt, cap combined runs at three, add 110-second start guard and stale-run recovery, and persist publication counts; deployed newsroom-scan, 45 regression tests passed. No live publication invoked.

- [x] Fix backend backlog retries, AI failure handling/live call accounting, and headline/RSS-only sports checks; preserve all other rules and schedules. Backend type validation and 43 regression tests passed; no live publishing run invoked.

- [x] Tighten homepage spacing, top stories, responsive grids, key numbers and existing-data sections; verified at 390/820/1280 with no horizontal overflow.
- [x] Verify anonymous visitors cannot read any table containing email/contact data; removed anonymous table reads while preserving insert-only public forms and safe public views.
- [x] Restore public SELECT (anon+authenticated) on all non-personal tables; writes admin/service-only; personal tables locked. Verified: 28 tables + Most Read RPC return 200 anonymously; personal tables denied.
- [ ] BLOCKED: live deploy keeps failing at the hosts build step ("Build incomplete" on statsgh.lovable.app; www.statsgh.com still serves the old broken build). Code verified working in a local production build. Needs the publish-dialog error details or Lovable support to see the production build log.
