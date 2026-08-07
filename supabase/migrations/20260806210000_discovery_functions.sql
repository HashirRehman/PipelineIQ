-- Discovery SQL support: the dismissed_reason column the dismiss UX needs,
-- plus the two SECURITY DEFINER functions that replace the old
-- upsert_job_engineer_match / create_lead_from_match RPCs.

alter table public.job_profile_states
  add column dismissed_reason text;

-- upsert_job_profile_match: persists one (job, profile, cv) score and makes
-- sure a live application-state row exists for the (job, profile) pair.
create or replace function public.upsert_job_profile_match(
  p_job_id uuid,
  p_profile_id uuid,
  p_cv_id uuid,
  p_relevance_score numeric,
  p_ai_model_version text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_match_id uuid;
begin
  select organization_id into v_org_id
  from public.profiles
  where id = p_profile_id;

  if v_org_id is null then
    raise exception 'Profile not found.';
  end if;

  insert into public.job_profile_matches (
    organization_id, job_id, profile_id, cv_id, relevance_score, ai_model_version
  ) values (
    v_org_id, p_job_id, p_profile_id, p_cv_id, p_relevance_score, p_ai_model_version
  )
  on conflict (job_id, profile_id, cv_id) do update
    set relevance_score = excluded.relevance_score,
        ai_model_version = excluded.ai_model_version,
        updated_at = now()
  returning id into v_match_id;

  insert into public.job_profile_states (organization_id, job_id, profile_id, status)
  values (v_org_id, p_job_id, p_profile_id, 'suggested')
  on conflict (job_id, profile_id) where deleted_at is null do nothing;

  return v_match_id;
end;
$$;

-- apply_job_profile: marks the (job, profile) pair applied (recording the
-- acting user + chosen CV) and creates the lead snapshot that represents the
-- employer reply. Replaces create_lead_from_match (which keyed off the old
-- single match row). Returns the new lead id.
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
  select organization_id, job_id, profile_id, cv_id
    into v_org_id, v_job_id, v_profile_id, v_cv_id
  from public.job_profile_matches
  where id = p_match_id;

  if v_job_id is null then
    raise exception 'Match not found.';
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

grant execute on function public.upsert_job_profile_match to authenticated, service_role;
grant execute on function public.apply_job_profile to authenticated, service_role;
