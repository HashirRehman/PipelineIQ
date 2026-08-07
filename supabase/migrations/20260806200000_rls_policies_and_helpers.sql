-- RLS helpers + policies for the fresh schema.
--
-- Security model:
--   * is_admin() (SECURITY DEFINER) is the write gate and the admin carve-out
--     everywhere; it reads the caller's users.role_id via auth.uid().
--   * Reference tables (organizations, roles, pipeline_stages, seniority_level,
--     scrapers, jobs) are readable by any authenticated user.
--   * Business tables scope reads through profile ownership (profiles.user_id)
--     and admin; writes are admin-only unless a SECURITY DEFINER function
--     (discovery RPCs) handles them.
--   * leads reads scope through the permanent user_id owner snapshot.
-- The service_role key bypasses RLS entirely (cron/admin writes).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'Admin'
      and u.deleted_at is null
  );
$$;

grant execute on function public.is_admin to authenticated, service_role;

-- Reference tables -----------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated using (true);

create policy roles_select on public.roles
  for select to authenticated using (true);

create policy pipeline_stages_select on public.pipeline_stages
  for select to authenticated using (true);

create policy seniority_level_select on public.seniority_level
  for select to authenticated using (true);

create policy scrapers_select on public.scrapers
  for select to authenticated using (true);

create policy jobs_select on public.jobs
  for select to authenticated using (true);

-- Users ---------------------------------------------------------------
-- User management is admin-only; a user can read/update their own row.
create policy users_select on public.users
  for select to authenticated using (is_admin() or id = auth.uid());

create policy users_insert on public.users
  for insert to authenticated with check (is_admin());

create policy users_update on public.users
  for update to authenticated using (is_admin() or id = auth.uid())
  with check (is_admin() or id = auth.uid());

-- Profiles -------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated using (is_admin() or user_id = auth.uid());

create policy profiles_insert on public.profiles
  for insert to authenticated with check (is_admin());

create policy profiles_update on public.profiles
  for update to authenticated using (is_admin() or user_id = auth.uid())
  with check (is_admin());

-- Profile CVs ----------------------------------------------------------
create policy profile_cvs_select on public.profile_cvs
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

create policy profile_cvs_insert on public.profile_cvs
  for insert to authenticated with check (is_admin());

create policy profile_cvs_update on public.profile_cvs
  for update to authenticated using (is_admin());

-- Match scores ---------------------------------------------------------
create policy job_profile_matches_select on public.job_profile_matches
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- Application states ----------------------------------------------------
create policy job_profile_states_select on public.job_profile_states
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- A BD may dismiss their own profile's application state; applied/lead
-- transitions go through the SECURITY DEFINER apply_job_profile() instead.
create policy job_profile_states_update on public.job_profile_states
  for update to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- Leads ----------------------------------------------------------------
create policy leads_select on public.leads
  for select to authenticated using (is_admin() or user_id = auth.uid());
