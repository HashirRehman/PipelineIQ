-- Grant SELECT on organizations to authenticated.
--
-- organizations was disabled for row-level security in migration
-- 20260812110000 because it was assumed the app wouldn't query it directly
-- via the authenticated client. However, app/api/organization/settings and
-- app/api/users both read from organizations to fetch settings
-- (allowed_email_domain) — both use createClient() (the authenticated user
-- client).
--
-- This is safe because organizations is a catalog table: a single org in
-- single-tenant mode; RLS (row filtering) is not needed. A SELECT grant
-- alone is sufficient.

grant select on public.organizations to authenticated;
