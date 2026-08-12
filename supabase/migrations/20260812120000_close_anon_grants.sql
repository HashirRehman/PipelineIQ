-- Close anon at the GRANT level (defense-in-depth under RLS).
--
-- Supabase's default privileges grant table access to the `anon` role on
-- every table created by a migration. The B5 hardening (migration 9)
-- revoked anon's privileges on the tables that existed then, but every
-- table created since — job_comments (migration 11) and audit_logs (the
-- audit-log migration) — inherited the defaults again: anon could issue
-- SELECT against them (RLS currently masks the rows — there are no anon
-- policies — and RLS denies anon writes, so this is NOT an active leak,
-- but a grant that exists only to be masked is one `disable row level
-- security` away from full exposure).
--
-- This migration:
--   1. Revokes ALL anon privileges on every public table (also clears any
--      residual insert/update/delete the B5 select-only revoke left behind
--      on the pre-existing tables).
--   2. Alters default privileges so tables created by future migrations
--      don't silently re-grant anon access.
--
-- Convention going forward: every `create table` migration must grant the
-- authenticated role its exact verbs explicitly (as job_comments already
-- does) and must NOT rely on default privileges. The authenticated-side
-- grants for the current tables are already asserted exactly by
-- 20260812110000_trim_rls_to_tenant_tables.sql; this migration only touches
-- anon.

revoke all privileges on all tables in schema public from anon;

-- Future tables created by the migration role start with no anon grants.
alter default privileges in schema public revoke all on tables from anon;
