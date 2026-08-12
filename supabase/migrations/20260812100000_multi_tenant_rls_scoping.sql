-- Multi-tenant RLS scoping.
--
-- Before this migration the RLS policies admitted any Admin / BD Manager
-- ("is_admin() or is_bd_manager()") to every business table regardless of
-- which organization a row belonged to, and the reference reads
-- (organizations_select, jobs_select) were `using (true)`. That was correct
-- for a single-tenant deployment and is a cross-tenant data leak the moment
-- a second organization exists: an Admin in org A could read and write
-- org B's jobs, profiles, leads, users and comments.
--
-- The invariant this migration enforces at the data layer:
--
--   Every row that belongs to an organization (directly via
--   organization_id, or transitively through its profile) is visible and
--   writable only by users of that same organization.
--
-- Design:
--   * current_org_id()  — the acting user's own organization id (fail-closed:
--                         NULL when there's no users row, so every scoped
--                         policy rejects).
--   * is_admin_in(org)  — "the acting user is an Admin OF THIS org".
--   * is_privileged_in(org) — "Admin or BD Manager OF THIS org" (the two
--                         privileged roles are identical in RLS everywhere
--                         except user management).
--   * The existing is_admin() / is_bd_manager() functions are left as-is —
--     they answer "who is the caller" — and every policy now ANDs them with
--     the org check via the helpers above.
--
-- Deliberately NOT scoped (product-level constants, shared across tenants):
-- roles, pipeline_stages, seniority_level, scrapers. These hold identical
-- catalog data for every org (role names, pipeline stage names, seniority
-- levels, scraper sources); scoping them would require duplicating the rows
-- per org for no security gain. If a tenant ever needs custom pipeline
-- stages, that's a schema change (add organization_id to pipeline_stages),
-- not a policy change.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

-- ---------------------------------------------------------------------------
-- Org helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.organization_id
  from public.users u
  where u.id = auth.uid() and u.deleted_at is null
$$;

create or replace function public.is_admin_in(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_org_id = public.current_org_id() and public.is_admin()
$$;

create or replace function public.is_privileged_in(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_org_id = public.current_org_id() and (public.is_admin() or public.is_bd_manager())
$$;

grant execute on function public.current_org_id to authenticated, service_role;
grant execute on function public.is_admin_in to authenticated, service_role;
grant execute on function public.is_privileged_in to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- organizations — a user sees only their own org's row.
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated using (id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- jobs — any member of the org reads/writes the org's jobs (existing
-- behavior, now org-scoped).
-- ---------------------------------------------------------------------------
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated using (organization_id = public.current_org_id());

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- users — roster reads admit the org's BD Managers too; managing users
-- (invite / edit others / delete) stays ADMIN-only, exactly as before, now
-- scoped to the org.
-- ---------------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (is_privileged_in(organization_id) or id = auth.uid());

drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert to authenticated with check (is_admin_in(organization_id));

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (is_admin_in(organization_id) or id = auth.uid())
  with check (
    is_admin_in(organization_id)
    or (
      -- Non-admins may only edit their own full_name (migration 6's B4
      -- hardening, unchanged — the immutable-field comparisons prevent
      -- self-escalation / self-soft-delete at the DB level).
      id = auth.uid()
      and role_id is not distinct from (
        select role_id from public.users where id = auth.uid()
      )
      and organization_id is not distinct from (
        select organization_id from public.users where id = auth.uid()
      )
      and is_active is not distinct from (
        select is_active from public.users where id = auth.uid()
      )
      and deleted_at is not distinct from (
        select deleted_at from public.users where id = auth.uid()
      )
      and email is not distinct from (
        select email from public.users where id = auth.uid()
      )
    )
  );

drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete to authenticated using (is_admin_in(organization_id));

-- ---------------------------------------------------------------------------
-- profiles — privileged roles scoped to the row's org; owners keep their
-- own rows.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (is_privileged_in(organization_id) or user_id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (is_privileged_in(organization_id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (is_privileged_in(organization_id) or user_id = auth.uid())
  with check (is_privileged_in(organization_id));

-- ---------------------------------------------------------------------------
-- Tables without a direct organization_id column derive their org from the
-- profile they hang off (profile_cvs, job_profile_matches,
-- job_profile_states). The privileged branch therefore checks the profile's
-- org; the owner branch (own profile) is already org-safe by construction.
-- ---------------------------------------------------------------------------
drop policy if exists profile_cvs_select on public.profile_cvs;
create policy profile_cvs_select on public.profile_cvs
  for select to authenticated
  using (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists profile_cvs_insert on public.profile_cvs;
create policy profile_cvs_insert on public.profile_cvs
  for insert to authenticated
  with check (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
  );

drop policy if exists profile_cvs_update on public.profile_cvs;
create policy profile_cvs_update on public.profile_cvs
  for update to authenticated
  using (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
  );

drop policy if exists job_profile_matches_select on public.job_profile_matches;
create policy job_profile_matches_select on public.job_profile_matches
  for select to authenticated
  using (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists job_profile_states_select on public.job_profile_states;
create policy job_profile_states_select on public.job_profile_states
  for select to authenticated
  using (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists job_profile_states_insert on public.job_profile_states;
create policy job_profile_states_insert on public.job_profile_states
  for insert to authenticated
  with check (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- Migration 6's B4 hardening is preserved: profile owners may only set their
-- own profile's state to applied / dismissed-with-reason; privileged roles
-- keep unrestricted updates, scoped to the org.
drop policy if exists job_profile_states_update on public.job_profile_states;
create policy job_profile_states_update on public.job_profile_states
  for update to authenticated
  using (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_privileged_in((select organization_id from public.profiles where id = profile_id))
    or (
      exists (
        select 1 from public.profiles p
        where p.id = profile_id and p.user_id = auth.uid()
      )
      and (
        status = 'applied'
        or (status = 'dismissed' and dismissed_reason is not null)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- leads — direct org column; privileged branch scoped, owner branches
-- (applier snapshot + current profile owner) unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    is_privileged_in(organization_id)
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    is_privileged_in(organization_id)
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = profile_id and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (
    is_privileged_in(organization_id)
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_privileged_in(organization_id)
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- job_comments — reads/inserts are open to any same-org member (the old
-- is_admin() escape hatch let cross-org admins in; it's gone — an admin is
-- a same-org member anyway). Updates (edits + moderation) stay author or
-- privileged-same-org.
-- ---------------------------------------------------------------------------
drop policy if exists job_comments_select on public.job_comments;
create policy job_comments_select on public.job_comments
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists job_comments_insert on public.job_comments;
create policy job_comments_insert on public.job_comments
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.organization_id = job_comments.organization_id
    )
  );

drop policy if exists job_comments_update on public.job_comments;
create policy job_comments_update on public.job_comments
  for update to authenticated
  using (is_privileged_in(organization_id) or user_id = auth.uid())
  with check (is_privileged_in(organization_id) or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_logs — inserts bound to the caller's org; reads stay ADMIN-only
-- (the team-management trail is not for BD Managers), now org-scoped.
-- ---------------------------------------------------------------------------
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (is_admin_in(organization_id));
