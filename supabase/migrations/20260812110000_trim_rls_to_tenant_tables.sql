-- Trim RLS to the tables that genuinely need row isolation.
--
-- The rule going forward: RLS is ROW isolation for tenant data. It belongs
-- on tables whose rows differ per organization (or per user) — where a
-- direct PostgREST query with any valid session must be filtered. Tables
-- that hold the same catalog rows for every org don't need it; plain
-- grants already express their access model (read-only catalog, or no
-- authenticated access at all).
--
-- What this migration changes:
--   * Revokes the seed's blanket `select, insert, update, delete on all
--     tables ... to authenticated` and replaces it with per-table grants
--     matching what the app actually uses through the user-scoped client.
--   * Disables RLS on the 4 catalog tables (roles, pipeline_stages,
--     seniority_level, scrapers) — they were `using (true)` anyway; with
--     select-only grants they stay exactly as readable and gain no write
--     path. Their row-isolation policies are dropped.
--   * Disables RLS on organizations and cron_run_locks — nothing in the
--     app reads these through the user client (the org id comes from
--     users.organization_id; cron writes use the service role), so they
--     get no authenticated grants at all and need no policies.
--   * KEEPS RLS on every tenant table (users, jobs, profiles, profile_cvs,
--     job_profile_matches, job_profile_states, leads, job_comments,
--     audit_logs). Those are the cross-tenant boundary from
--     20260812100000_multi_tenant_rls_scoping.sql — the direct-PostgREST
--     hole exists there and grants alone cannot close it.
--
-- service_role keeps its blanket grants (untouched) — it's the admin/cron
-- path and bypasses RLS by design.
--
-- Apply in order after 20260812100000 (this migration drops policies it
-- created and grants audit_logs, which ships in 20260812010000).

-- 1. Revoke the blanket CRUD grant from the authenticated role.
revoke select, insert, update, delete on all tables in schema public from authenticated;

-- 2. Catalog tables: read-only for authenticated, no row isolation needed.
grant select on public.roles, public.pipeline_stages, public.seniority_level, public.scrapers to authenticated;

alter table public.roles disable row level security;
drop policy if exists roles_select on public.roles;

alter table public.pipeline_stages disable row level security;
drop policy if exists pipeline_stages_select on public.pipeline_stages;

alter table public.seniority_level disable row level security;
drop policy if exists seniority_level_select on public.seniority_level;

alter table public.scrapers disable row level security;
drop policy if exists scrapers_select on public.scrapers;

-- 3. Org identity + infra: no authenticated access (org id is read from the
-- RLS'd users row; cron_run_locks is service-role only).
alter table public.organizations disable row level security;
drop policy if exists organizations_select on public.organizations;

alter table public.cron_run_locks disable row level security;

-- 4. Tenant tables: grants match the verbs the app actually issues through
-- the user client. RLS (from the multi-tenant scoping migration) is what
-- restricts these to the caller's org — grants alone would open every row.
grant select, insert, update, delete on public.users to authenticated;
grant select, insert on public.jobs to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profile_cvs to authenticated;
grant select on public.job_profile_matches to authenticated;
grant select, insert, update on public.job_profile_states to authenticated;
grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.job_comments to authenticated;
grant select, insert on public.audit_logs to authenticated;
