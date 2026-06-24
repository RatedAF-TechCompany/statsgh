## Plan: Fix the failing GitHub scheduled jobs

### Problem
The failing GitHub Actions are still calling:

```text
${{ secrets.SUPABASE_URL }}/functions/v1/...
Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

In GitHub, those secrets are blank, so `curl` receives only `/functions/v1/...` and fails with:

```text
URL rejected: No host part in the URL
```

### Fix
Update the two failing workflow files:

1. `.github/workflows/newsroom-cron.yml`
   - Stop depending on GitHub `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets.
   - Call the existing public scheduled wrapper instead:

```text
https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/newsroom-scheduled?token=statsgh-newsroom-2026
```

   - This wrapper already runs server-side with the internal backend credentials and then invokes `newsroom-scan`.

2. `.github/workflows/bog-scan-cron.yml`
   - Stop depending on blank GitHub secrets.
   - Call the Lovable Cloud edge function URL directly:

```text
https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/bog-dashboard-scan
```

   - Use the publishable/anon key header instead of service-role auth, because this function has `verify_jwt = false`.

3. Leave `.github/workflows/market-newsletter-cron.yml` unchanged for now
   - It is already succeeding in your screenshot.

### Validation
After the change:
- The GitHub curl URL will include a real host, so the “No host part in the URL” error should disappear.
- Re-running **Newsroom Scheduled Scan** should reach `newsroom-scheduled`.
- Re-running **BoG Dashboard Update Scanner** should reach `bog-dashboard-scan`.
- The only remaining failures, if any, would be inside the backend functions themselves rather than GitHub secret configuration.