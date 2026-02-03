# Existing accounts without business_id or business name

If you have users who signed up (e.g. via Google/Microsoft) before business name was required, their profile may have no `business_id` and no linked business.

## Option 1: Let them complete in the app (recommended)

When a user signs in and has no `business_id`, the app redirects them to **Complete your account** (`/signup/complete-business`). They enter a business name; the app creates the business and links their profile. No manual work.

## Option 2: Add business and business_id manually (SQL)

You can create a business for each profile that has no `business_id` and set `business_id` and `role`:

```sql
-- Example: create one business per profile that has no business_id,
-- using profile email and a placeholder name. Run in Supabase SQL editor.

INSERT INTO public.businesses (name, email, subscription_tier, subscription_status)
SELECT
  COALESCE(p.full_name, p.email, 'My Business') || ' (migrated)',
  p.email,
  'basic',
  'trialing'
FROM public.profiles p
WHERE p.business_id IS NULL
  AND p.is_super_admin = false;

UPDATE public.profiles p
SET
  business_id = b.id,
  role = 'manager'
FROM public.businesses b
WHERE p.business_id IS NULL
  AND p.is_super_admin = false
  AND b.email = p.email
  AND b.name LIKE '% (migrated)';
```

Adjust the `name` logic if you prefer (e.g. a fixed placeholder like `'My Business'`). If multiple profiles share the same email, the `UPDATE` may match more than one business; use a more specific join if needed (e.g. by `created_at` or a one-off id).

## Option 3: Remove those accounts

If these are test or unwanted accounts:

- **Delete from auth:** In Supabase Dashboard → Authentication → Users, delete the user. With default FK settings, this can cascade to `public.profiles` (if `profiles.id` references `auth.users(id) ON DELETE CASCADE`).
- **Delete only profile:** Deleting only the profile row leaves the user in `auth.users`; they can sign in but will have no profile and may hit errors. Prefer deleting the auth user if you want the account gone.

After any manual SQL (option 2), have users sign in again so the app sees the updated profile and business.
