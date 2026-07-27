-- Module 4 follow-up — engineers/jobs visibility carve-out for BD-owned
-- leads that survive reassignment.
--
-- leads.bd_user_id is a permanent ownership snapshot (doc 01 §7: "lets a
-- BD Executive keep visibility into their own historical leads after an
-- engineer is reassigned to someone else") — proven live this sub-chunk.
-- But engineers_select/jobs_select are current-assignment-only (doc 01
-- §9: "no visibility into engineers not assigned to them, even if a
-- former assignment existed"), and neither passage acknowledges the
-- other. In practice this meant a BD's own /leads row stayed visible
-- after reassignment, but its embedded engineer name / job title went
-- blank, because those embeds are gated by engineers_select/jobs_select,
-- not leads_select. Reconciled per team decision: a BD keeps full
-- engineer/job detail for leads they still own, regardless of current
-- assignment.
create or replace function public.owned_lead_engineer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select engineer_id
  from public.leads
  where bd_user_id = auth.uid();
$$;

comment on function public.owned_lead_engineer_ids() is
  'SECURITY DEFINER helper. Engineer IDs referenced by leads auth.uid() permanently owns, independent of current engineer_bd_assignments. Composed into engineers_select alongside assigned_engineer_ids(), same pattern.';

-- Separate helper (not routed through job_engineer_matches) — that table
-- has its own current-assignment-only RLS, and a plain (non-DEFINER)
-- EXISTS subquery against it inside jobs_select would still be subject
-- to that RLS for the querying role, silently defeating the carve-out.
-- Reading leads.job_id directly here, same as owned_lead_engineer_ids()
-- reads leads.engineer_id directly, sidesteps that trap the same way
-- assigned_engineer_ids() sidesteps engineer_bd_assignments' RLS.
create or replace function public.owned_lead_job_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select job_id
  from public.leads
  where bd_user_id = auth.uid();
$$;

comment on function public.owned_lead_job_ids() is
  'SECURITY DEFINER helper. Job IDs referenced by leads auth.uid() permanently owns, independent of current engineer_bd_assignments. Composed into jobs_select alongside the existing job_engineer_matches-transitive rule.';

drop policy engineers_select on public.engineers;
create policy engineers_select on public.engineers
for select
to authenticated
using (
  public.is_admin()
  or id in (select public.assigned_engineer_ids())
  or id in (select public.owned_lead_engineer_ids())
);

drop policy jobs_select on public.jobs;
create policy jobs_select on public.jobs
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.job_engineer_matches jem
    where jem.job_id = jobs.id
      and jem.engineer_id in (select public.assigned_engineer_ids())
  )
  or id in (select public.owned_lead_job_ids())
);
