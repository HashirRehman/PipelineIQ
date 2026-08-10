-- BD Manager full access: mirrors Admin everywhere except user management.
--
-- Permission model (supersedes the migration 14 view-only model):
--   * Admin              — everything, including managing users (invite,
--                          edit, deactivate/delete any team member).
--   * BD Manager         — everything Admin has EXCEPT user management:
--                          full Profiles / Discovery / Pipeline / Leads /
--                          Statistics access (view + write), and the team
--                          roster — but no invites, and no editing /
--                          deactivating / deleting other team members.
--   * Business Developer — no Users / Profiles pages; sees the job pages.
--
-- So this migration widens every business-table policy that was admin-only
-- (or admin-or-owner) to also admit is_bd_manager(): profiles, profile_cvs,
-- job_profile_matches, job_profile_states, leads, and job_comments updates
-- (comment soft-deletes / moderation). `users` is deliberately NOT widened
-- beyond migration 14: users_select already lets BD Managers read the
-- roster, users_update (hardened in migration 6's B4) lets them edit only
-- their own full_name, and users_insert / users_delete stay admin-only —
-- inviting and managing other team members remain Admin-only even at the
-- DB level.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

-- Profiles ---------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (is_admin() or is_bd_manager() or user_id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (is_admin() or is_bd_manager());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (is_admin() or is_bd_manager() or user_id = auth.uid())
  with check (is_admin() or is_bd_manager());

-- Profile CVs ------------------------------------------------------------
drop policy if exists profile_cvs_select on public.profile_cvs;
create policy profile_cvs_select on public.profile_cvs
  for select to authenticated
  using (
    is_admin()
    or is_bd_manager()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists profile_cvs_insert on public.profile_cvs;
create policy profile_cvs_insert on public.profile_cvs
  for insert to authenticated with check (is_admin() or is_bd_manager());

drop policy if exists profile_cvs_update on public.profile_cvs;
create policy profile_cvs_update on public.profile_cvs
  for update to authenticated using (is_admin() or is_bd_manager());

-- Match scores -----------------------------------------------------------
drop policy if exists job_profile_matches_select on public.job_profile_matches;
create policy job_profile_matches_select on public.job_profile_matches
  for select to authenticated
  using (
    is_admin()
    or is_bd_manager()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- Application states -----------------------------------------------------
drop policy if exists job_profile_states_select on public.job_profile_states;
create policy job_profile_states_select on public.job_profile_states
  for select to authenticated
  using (
    is_admin()
    or is_bd_manager()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists job_profile_states_insert on public.job_profile_states;
create policy job_profile_states_insert on public.job_profile_states
  for insert to authenticated
  with check (
    is_admin()
    or is_bd_manager()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- Migration 6's B4 hardening narrowed the owner branch to applied/dismissed;
-- Admins and BD Managers keep unrestricted updates (any pipeline stage).
drop policy if exists job_profile_states_update on public.job_profile_states;
create policy job_profile_states_update on public.job_profile_states
  for update to authenticated
  using (
    is_admin()
    or is_bd_manager()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or is_bd_manager()
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

-- Leads ------------------------------------------------------------------
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated using (is_admin() or is_bd_manager() or user_id = auth.uid());

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    is_admin()
    or is_bd_manager()
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
  using (is_admin() or is_bd_manager() or user_id = auth.uid())
  with check (is_admin() or is_bd_manager() or user_id = auth.uid());

-- Job comments: select/insert are already org-scoped (any same-org user);
-- update (edits + soft-delete moderation) was author-or-admin — BD Managers
-- mirror Admins, so admit them too.
drop policy if exists job_comments_update on public.job_comments;
create policy job_comments_update on public.job_comments
  for update to authenticated
  using (is_admin() or is_bd_manager() or user_id = auth.uid())
  with check (is_admin() or is_bd_manager() or user_id = auth.uid());

-- users policies intentionally unchanged (migration 14 + migration 6 B4).
