-- Discovery actions keyed on (job, profile) pairs instead of match rows.
--
-- Mark-applied and dismiss are lifecycle state changes on job_profile_states,
-- which is keyed on (job_id, profile_id). They must work even when no
-- job_profile_matches row exists yet (a job that hasn't been scored by a
-- discovery run). Both functions authorize themselves (SECURITY DEFINER
-- bypasses RLS): caller must be admin or acting on their own profile.

-- apply_job_profile: signature changed from (p_match_id, p_user_id) to
-- (p_job_id, p_profile_id, p_user_id). The best scored match's CV is recorded
-- on the state row when one exists, otherwise null (unscored job).
create or replace function public.apply_job_profile(
  p_job_id uuid,
  p_profile_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_cv_id uuid;
  v_state_id uuid;
  v_lead_id uuid;
  v_stage_id uuid;
begin
  if not (public.is_admin() or p_user_id = auth.uid()) then
    raise exception 'Not authorized to apply for this profile.';
  end if;

  select organization_id into v_org_id
  from public.profiles
  where id = p_profile_id;

  if v_org_id is null then
    raise exception 'Profile not found.';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = p_profile_id and p.user_id = auth.uid()
    )
  ) then
    raise exception 'Not authorized to apply for this profile.';
  end if;

  -- jobs are world-readable (RLS using(true)), so scope the reference to the
  -- caller's org to prevent cross-org state/lead rows.
  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.organization_id = v_org_id
  ) then
    raise exception 'Job not found.';
  end if;

  select cv_id into v_cv_id
  from public.job_profile_matches
  where job_id = p_job_id and profile_id = p_profile_id
  order by relevance_score desc
  limit 1;

  insert into public.job_profile_states (
    organization_id, job_id, profile_id, status, user_id, cv_id
  ) values (
    v_org_id, p_job_id, p_profile_id, 'applied', p_user_id, v_cv_id
  )
  on conflict (job_id, profile_id) where deleted_at is null
  do update
    set status = 'applied', user_id = excluded.user_id,
        cv_id = excluded.cv_id, updated_at = now()
  returning id into v_state_id;

  select id into v_stage_id
  from public.pipeline_stages
  order by order_index
  limit 1;

  -- Duplicate-lead prevention (project rule: at most one live lead per
  -- (job, profile) pair): supersede any prior live lead before inserting
  -- the fresh snapshot.
  update public.leads
  set deleted_at = now()
  where job_id = p_job_id and profile_id = p_profile_id and deleted_at is null;

  insert into public.leads (
    organization_id, job_id, profile_id, job_profile_state_id, user_id, pipeline_stage_id
  ) values (
    v_org_id, p_job_id, p_profile_id, v_state_id, p_user_id, v_stage_id
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

-- dismiss_job_profile: sets (or creates) the pair's live state row to
-- 'dismissed' with a reason. Works without a match row.
create or replace function public.dismiss_job_profile(
  p_job_id uuid,
  p_profile_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = p_profile_id and p.user_id = auth.uid()
    )
  ) then
    raise exception 'Not authorized to dismiss this profile.';
  end if;

  select organization_id into v_org_id
  from public.profiles
  where id = p_profile_id;

  if v_org_id is null then
    raise exception 'Profile not found.';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A dismissal reason is required.';
  end if;

  -- jobs are world-readable (RLS using(true)), so scope the reference to the
  -- caller's org to prevent cross-org state rows.
  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.organization_id = v_org_id
  ) then
    raise exception 'Job not found.';
  end if;

  insert into public.job_profile_states (
    organization_id, job_id, profile_id, status, dismissed_reason
  ) values (
    v_org_id, p_job_id, p_profile_id, 'dismissed', p_reason
  )
  on conflict (job_id, profile_id) where deleted_at is null
  do update
    set status = 'dismissed', dismissed_reason = excluded.dismissed_reason,
        updated_at = now();
end;
$$;

-- Scoped grants. The create-or-replace above replaces the old
-- (p_match_id, p_user_id) apply_job_profile signature entirely; these
-- revokes strip the default PUBLIC (hence anon) execute from the fresh ones.
revoke execute on function public.apply_job_profile(
  p_job_id uuid, p_profile_id uuid, p_user_id uuid
) from public, anon, service_role;
grant execute on function public.apply_job_profile(
  p_job_id uuid, p_profile_id uuid, p_user_id uuid
) to authenticated;

revoke execute on function public.dismiss_job_profile from public, anon, service_role;
grant execute on function public.dismiss_job_profile to authenticated;
