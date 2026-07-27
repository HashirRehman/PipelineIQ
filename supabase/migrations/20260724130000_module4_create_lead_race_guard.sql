-- Module 4 — defense-in-depth for create_lead_from_match()'s duplicate
-- check. The proactive "if exists" check and the leads insert are two
-- separate statements with no lock between them — under a tight enough
-- concurrent race, two calls could both pass the check before either
-- inserts, and the second insert would then hit the real partial unique
-- index directly. A forced concurrent test (sub-chunk 1) did not
-- reproduce this in practice, but the function had no handler for it —
-- closing that as a documented theoretical gap now, not leaving it.
create or replace function public.create_lead_from_match(
  p_match_id    uuid,
  p_bd_user_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id              uuid;
  v_engineer_id         uuid;
  v_match_status        public.match_status;
  v_lead_id             uuid;
  v_applied_stage_id    uuid;
  v_stage_changed_type  uuid;
begin
  if not (public.is_admin() or p_bd_user_id = auth.uid()) then
    raise exception 'Not authorized to create a lead for this BD.';
  end if;

  select job_id, engineer_id, status into v_job_id, v_engineer_id, v_match_status
  from public.job_engineer_matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found.';
  end if;

  if not (public.is_admin() or v_engineer_id in (select public.assigned_engineer_ids())) then
    raise exception 'Not authorized to act on this match.';
  end if;

  if v_match_status = 'dismissed' then
    raise exception 'This match was dismissed and cannot be converted to a lead.';
  end if;

  if exists (
    select 1 from public.leads
    where job_id = v_job_id and engineer_id = v_engineer_id and status <> 'withdrawn'
  ) then
    raise exception 'An active or closed lead already exists for this engineer and job.';
  end if;

  select id into v_applied_stage_id from public.pipeline_stages where name = 'Applied';
  select id into v_stage_changed_type from public.lead_event_types where code = 'stage_changed';

  -- The proactive check above and this insert are not atomic with each
  -- other — under a tight enough race, two callers can both pass the
  -- check before either inserts. The partial unique index still
  -- guarantees only one insert can ever succeed; this handler is what
  -- guarantees the loser sees the same clean message as the proactive
  -- check, never a raw unique_violation, regardless of timing.
  begin
    insert into public.leads (job_id, engineer_id, job_engineer_match_id, bd_user_id, current_stage_id)
    values (v_job_id, v_engineer_id, p_match_id, p_bd_user_id, v_applied_stage_id)
    returning id into v_lead_id;
  exception
    when unique_violation then
      raise exception 'An active or closed lead already exists for this engineer and job.';
  end;

  -- A match already flipped to 'applied' from a prior, now-withdrawn lead
  -- is legitimately reusable (doc 02 §14: "a match can be reused across
  -- multiple leads over time — e.g. withdraw -> reapply") — the real
  -- duplicate gate is the leads partial unique index above, not this
  -- column, so 'suggested' is deliberately not required here.
  update public.job_engineer_matches
  set status = 'applied'
  where id = p_match_id and status <> 'dismissed';

  insert into public.lead_events (lead_id, event_type_id, stage_id, created_by)
  values (v_lead_id, v_stage_changed_type, v_applied_stage_id, auth.uid());

  return v_lead_id;
end;
$$;

comment on function public.create_lead_from_match(uuid, uuid) is
  'Atomically creates a lead from an AI-suggested match: duplicate check, leads insert (with a unique_violation handler as a race-safe fallback to the same proactive check), job_engineer_matches status flip to applied, and the initial lead_events row all in one transaction — never a bare INSERT.';
