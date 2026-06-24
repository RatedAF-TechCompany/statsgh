# Grant Admin Access to /admin/analytics

## Current State
- `officeofstatsgh@gmail.com` has **no account** in the database yet.
- The `handle_new_user` trigger only auto-grants `admin` to the hardcoded master email `officeofnajib@gmail.com`. All other signups get `user` role, which cannot access `/admin/*`.

## Steps

### 1. You sign up (required first)
Go to `https://statsgh.com/auth`, click **"Don't have an account? Sign up"**, and register with:
- Email: `officeofstatsgh@gmail.com`
- Password: (your choice)

This creates the `auth.users` row + a `profiles` row + a `user_roles` row with role `user`.

### 2. I run a migration to promote you to admin
Once you confirm the account is created, I'll run:

```sql
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'officeofstatsgh@gmail.com');
```

(Insert instead if no row exists.)

### 3. You log in
Refresh `/auth`, log in, and you'll be redirected to `/dashboard`. `/admin/analytics` will then be accessible.

## Out of Scope
- No changes to the `handle_new_user` trigger or master-email logic.
- No code changes to auth UI, routes, or RLS policies.

## Next Action From You
Reply once you've signed up, and I'll run the role-promotion migration.
