-- Post-reset hardening (B3, B4, B5, C6, C7, E1 of docs/hardening-fixes-plan.md)

-- ---------------------------------------------------------------------------
-- E1: trigger helper — recreate with an explicit search_path (the old
-- set_updated_at() set public, pg_temp; the fresh function omitted it).
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- B5: drop anon grants (correct already-seeded DBs; seed.sql is edited to
-- stop granting them going forward). Old schema revoked everything from anon.
-- ---------------------------------------------------------------------------
revoke select on all tables in schema public from anon;
revoke usage on type public.application_status from anon;

-- ---------------------------------------------------------------------------
-- B3: SECURITY DEFINER functions — revoke the default PUBLIC (hence anon)
-- execute and scope grants to the roles that actually call them.
--   * apply_job_profile: only the user-session mark-applied route calls it.
--   * upsert_job_profile_match: only the cron (service client) calls it.
-- ---------------------------------------------------------------------------
revoke execute on function public.is_admin from public, anon;
grant execute on function public.is_admin to authenticated, service_role;

revoke execute on function public.apply_job_profile from public, anon, service_role;
grant execute on function public.apply_job_profile to authenticated;

revoke execute on function public.upsert_job_profile_match from public, anon, authenticated;
grant execute on function public.upsert_job_profile_match to service_role;

-- B3: apply_job_profile — add the authorization checks that lived inside the
-- old create_lead_from_match. SECURITY DEFINER bypasses RLS, so the function
-- body must authorize itself: caller must be admin OR acting on their own
-- identity, and the match's profile must belong to the caller unless admin.
create or replace function public.apply_job_profile(
  p_match_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_job_id uuid;
  v_profile_id uuid;
  v_cv_id uuid;
  v_state_id uuid;
  v_lead_id uuid;
  v_stage_id uuid;
begin
  if not (public.is_admin() or p_user_id = auth.uid()) then
    raise exception 'Not authorized to apply for this profile.';
  end if;

  select organization_id, job_id, profile_id, cv_id
    into v_org_id, v_job_id, v_profile_id, v_cv_id
  from public.job_profile_matches
  where id = p_match_id;

  if v_job_id is null then
    raise exception 'Match not found.';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = v_profile_id and p.user_id = auth.uid()
    )
  ) then
    raise exception 'Not authorized to apply for this profile.';
  end if;

  select id into v_state_id
  from public.job_profile_states
  where job_id = v_job_id and profile_id = v_profile_id and deleted_at is null
  order by created_at desc
  limit 1;

  if v_state_id is null then
    insert into public.job_profile_states (
      organization_id, job_id, profile_id, status, user_id, cv_id
    ) values (
      v_org_id, v_job_id, v_profile_id, 'applied', p_user_id, v_cv_id
    )
    returning id into v_state_id;
  else
    update public.job_profile_states
    set status = 'applied', user_id = p_user_id, cv_id = v_cv_id, updated_at = now()
    where id = v_state_id;
  end if;

  select id into v_stage_id
  from public.pipeline_stages
  order by order_index
  limit 1;

  -- Duplicate-lead prevention (project rule: at most one live lead per
  -- (job, profile) pair): supersede any prior live lead before inserting
  -- the fresh snapshot. Leads are soft-deleted in the fresh schema.
  update public.leads
  set deleted_at = now()
  where job_id = v_job_id and profile_id = v_profile_id and deleted_at is null;

  insert into public.leads (
    organization_id, job_id, profile_id, job_profile_state_id, user_id, pipeline_stage_id
  ) values (
    v_org_id, v_job_id, v_profile_id, v_state_id, p_user_id, v_stage_id
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- B4: users_update — a non-admin may only edit their own full_name. role_id,
-- organization_id, is_active, deleted_at and email (auth-synced) are
-- admin-only, so a user can no longer self-escalate or self-soft-delete at
-- the DB level (old profiles_update was admin-only; the fresh WITH CHECK
-- allowed self-escalation).
-- ---------------------------------------------------------------------------
drop policy users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (is_admin() or id = auth.uid())
  with check (
    is_admin()
    or (
      -- Non-admins may only edit their own full_name. role_id, organization_id,
      -- is_active and deleted_at are admin-only; email is auth-synced (see
      -- sync_user_email) and must not be writable directly or it drifts from
      -- auth.users.
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

-- ---------------------------------------------------------------------------
-- B4: job_profile_states_update — a BD may only dismiss their own profile's
-- state (with a reason, exactly what the dismiss route does). Directly
-- setting status = 'applied' bypasses apply_job_profile() and the lead
-- snapshot, so it is no longer allowed for non-admins.
-- ---------------------------------------------------------------------------
drop policy job_profile_states_update on public.job_profile_states;
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
    or (
      status = 'dismissed'
      and dismissed_reason is not null
      and exists (
        select 1 from public.profiles p
        where p.id = profile_id and p.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- C6: profiles.user_id FK — NO ACTION meant deleting an auth user (which
-- cascades auth.users -> users) failed while a profile referenced it. The old
-- schema cascaded profiles from auth.users; here the profile survives and is
-- simply unlinked.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- C7: profile_cvs hardening constraints that existed on the old engineer_cvs
-- (mime whitelist, 10 MB ceiling, unique storage path).
-- ---------------------------------------------------------------------------
alter table public.profile_cvs
  add constraint profile_cvs_file_type_check
  check (file_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ));

alter table public.profile_cvs
  add constraint profile_cvs_file_size_check
  check (file_size_bytes > 0 and file_size_bytes <= 10485760);

create unique index profile_cvs_storage_path_key on public.profile_cvs (storage_path);
