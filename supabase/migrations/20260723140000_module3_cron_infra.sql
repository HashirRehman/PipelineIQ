-- Module 3 — cron infrastructure: run-lock + conditional match upsert
--
-- cron_run_locks exists so two overlapping invocations of the nightly
-- discovery cron (e.g. a manual trigger while the scheduled one is still
-- running) skip redundant external API calls entirely, rather than
-- relying on the job_engineer_matches unique constraint to merely absorb
-- the collision at the row level (it would — but only after both
-- invocations had already wastefully called JSearch/Groq in full).
create table public.cron_run_locks (
  id         text primary key,
  is_running boolean not null default false,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.cron_run_locks is
  'Single-row-per-job-type mutex. No end-user relevance — RLS enabled with zero policies, service_role only, same as every other cron-only table.';

create trigger set_cron_run_locks_updated_at
before update on public.cron_run_locks
for each row
execute function public.set_updated_at();

alter table public.cron_run_locks enable row level security;
-- Deliberately no policies at all for any role.

revoke all on public.cron_run_locks from anon, authenticated;
grant select, update on public.cron_run_locks to service_role;

insert into public.cron_run_locks (id, is_running) values ('discover-jobs', false);

-- upsert_job_engineer_match(): the only thing that actually implements
-- "only refresh relevance_score/ai_model_version while status is still
-- suggested" — a plain supabase-js .upsert() has no way to express a
-- conditional ON CONFLICT ... WHERE clause, so this needs to be one atomic
-- SQL statement. New pairing -> insert. Existing + still 'suggested' ->
-- update. Existing + dismissed/applied -> left untouched, no error.
create or replace function public.upsert_job_engineer_match(
  p_job_id           uuid,
  p_engineer_id      uuid,
  p_relevance_score  numeric,
  p_ai_model_version text
)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into public.job_engineer_matches (job_id, engineer_id, relevance_score, ai_model_version)
  values (p_job_id, p_engineer_id, p_relevance_score, p_ai_model_version)
  on conflict (job_id, engineer_id) do update
  set relevance_score = excluded.relevance_score,
      ai_model_version = excluded.ai_model_version,
      updated_at = now()
  where public.job_engineer_matches.status = 'suggested';
$$;

comment on function public.upsert_job_engineer_match(uuid, uuid, numeric, text) is
  'Cron-only upsert for job_engineer_matches. Never overwrites a row a BD has already dismissed or applied to, matching "AI surfaces and suggests; BD decides."';

revoke all on function public.upsert_job_engineer_match(uuid, uuid, numeric, text) from public;
grant execute on function public.upsert_job_engineer_match(uuid, uuid, numeric, text) to service_role;
