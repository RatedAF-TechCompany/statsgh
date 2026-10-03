# Roadmap

- [x] Restore public SELECT (anon+authenticated) on all non-personal tables; writes admin/service-only; personal tables locked. Verified: 28 tables + Most Read RPC return 200 anonymously; personal tables denied.
- [ ] BLOCKED: live deploy keeps failing at the hosts build step ("Build incomplete" on statsgh.lovable.app; www.statsgh.com still serves the old broken build). Code verified working in a local production build. Needs the publish-dialog error details or Lovable support to see the production build log.
