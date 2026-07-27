-- Module 3 — Job Discovery: job_sources, jobs, job_engineer_matches
--
-- Nothing in this module is written by an RLS-scoped user session — the
-- nightly cron has no user at all, so it writes via the service-role
-- client. service_role has rolbypassrls = true (confirmed against this
-- project) but holds NO table grants by default here — GRANT and RLS are
-- independent layers, so every table the cron touches needs an explicit
-- grant below or it fails in production with permission denied, same as
-- the "permission denied for table X" errors hit during Module 2 testing.

-- ----------------------------------------------------------------------------
-- Table: job_sources (configurable platform registry)
-- ----------------------------------------------------------------------------
create table public.job_sources (
  id         uuid primary key default extensions.gen_random_uuid(),
  name       text not null,
  slug       text not null,
  base_url   text,
  is_active  boolean not null default true,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_sources_name_key unique (name),
  constraint job_sources_slug_key unique (slug)
);

comment on table public.job_sources is
  'Configurable job-platform registry — adding a source is an INSERT, not a migration. slug identifies which lib/job-sources adapter handles it. Soft-disabled via is_active, never hard-deleted, same pattern as skills.';

-- ----------------------------------------------------------------------------
-- Table: jobs (ingested listings)
-- ----------------------------------------------------------------------------
create table public.jobs (
  id              uuid primary key default extensions.gen_random_uuid(),
  job_source_id   uuid not null references public.job_sources (id),
  external_job_id text not null,
  title           text not null,
  company_name    text not null,
  location        text,
  description     text,
  apply_url       text not null,
  is_remote       boolean,
  remote_region   text,
  posted_at       timestamptz,
  discovered_at   timestamptz not null default now(),
  dedup_hash      text,
  created_at      timestamptz not null default now(),
  constraint jobs_source_external_id_key unique (job_source_id, external_job_id)
);

comment on table public.jobs is
  'Ingested job listings. Unique (job_source_id, external_job_id) is the re-run-safety net the nightly cron''s upsert relies on. dedup_hash is a separate, non-unique signal reserved for a future cross-platform duplicate-detection feature — it is not itself an idempotency mechanism.';

create index idx_jobs_dedup_hash on public.jobs (dedup_hash);
create index idx_jobs_is_remote on public.jobs (is_remote);

-- ----------------------------------------------------------------------------
-- Table: job_engineer_matches (AI-generated pairing + relevance score)
-- ----------------------------------------------------------------------------
create type public.match_status as enum ('suggested', 'dismissed', 'applied');

create table public.job_engineer_matches (
  id                uuid primary key default extensions.gen_random_uuid(),
  job_id            uuid not null references public.jobs (id),
  engineer_id       uuid not null references public.engineers (id),
  relevance_score   numeric(5,2) not null check (relevance_score >= 0 and relevance_score <= 100),
  ai_model_version  text not null,
  status            public.match_status not null default 'suggested',
  dismissed_reason  text,
  recommended_cv_id uuid references public.engineer_cvs (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint job_engineer_matches_job_engineer_key unique (job_id, engineer_id)
);

comment on table public.job_engineer_matches is
  'AI-generated job/engineer pairing + relevance score. Unique (job_id, engineer_id) — one AI suggestion per pairing, ever. The nightly cron upserts on this key and must only update relevance_score/ai_model_version while status is still ''suggested'' — never overwriting a row a BD has already dismissed or applied to.';

create index idx_job_engineer_matches_engineer_score on public.job_engineer_matches (engineer_id, relevance_score desc);
create index idx_job_engineer_matches_job_id on public.job_engineer_matches (job_id);

create trigger set_job_engineer_matches_updated_at
before update on public.job_engineer_matches
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.job_sources          enable row level security;
alter table public.jobs                 enable row level security;
alter table public.job_engineer_matches enable row level security;

-- job_sources — Admin-managed lookup, everyone reads ------------------------
create policy job_sources_select on public.job_sources
for select
to authenticated
using (true);

create policy job_sources_insert on public.job_sources
for insert
to authenticated
with check (public.is_admin());

create policy job_sources_update on public.job_sources
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Deliberately no DELETE policy — soft-disable via is_active only.

-- jobs — visibility transitive through the matched engineer's CURRENT
-- assignment (same current-assignment rule as everything else in Module 2,
-- not the permanent leads.bd_user_id snapshot leads will use) -------------
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
);

-- Deliberately no INSERT/UPDATE/DELETE policy for authenticated — jobs are
-- written exclusively by the nightly cron via the service-role client.

-- job_engineer_matches — same transitive-visibility rule as jobs ----------
create policy job_engineer_matches_select on public.job_engineer_matches
for select
to authenticated
using (
  public.is_admin()
  or engineer_id in (select public.assigned_engineer_ids())
);

-- A BD can update a match for one of their currently-assigned engineers
-- (this is what the Dismiss action uses); the accompanying GRANT below is
-- column-scoped to status/dismissed_reason only, since RLS is row-level,
-- not column-level, and a blanket UPDATE grant would let a client rewrite
-- relevance_score/ai_model_version directly, bypassing the AI pipeline.
create policy job_engineer_matches_update on public.job_engineer_matches
for update
to authenticated
using (
  public.is_admin()
  or engineer_id in (select public.assigned_engineer_ids())
)
with check (
  public.is_admin()
  or engineer_id in (select public.assigned_engineer_ids())
);

-- Deliberately no INSERT policy for authenticated — new match rows are
-- cron-only. Deliberately no DELETE policy — matches are never removed.

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
revoke all on public.job_sources          from anon, authenticated;
revoke all on public.jobs                 from anon, authenticated;
revoke all on public.job_engineer_matches from anon, authenticated;

grant select, insert, update on public.job_sources to authenticated;
-- No delete grant, to any role, ever.

grant select on public.jobs to authenticated;
-- No insert/update/delete grant to authenticated — cron (service_role) only.

grant select on public.job_engineer_matches to authenticated;
grant update (status, dismissed_reason) on public.job_engineer_matches to authenticated;
-- No insert/delete grant to authenticated — cron (service_role) only.

-- service_role: exactly what the nightly cron needs to read (engineer
-- context for scoring, active sources to fetch from) and write (jobs,
-- matches) — nothing more. service_role has rolbypassrls but no table
-- grants by default in this project, so every one of these is required.
grant select on public.job_sources    to service_role;
grant select on public.engineers      to service_role;
grant select on public.engineer_skills to service_role;
grant select on public.skills         to service_role;
grant select on public.seniority_levels to service_role;
grant select on public.app_settings   to service_role;

grant select, insert, update on public.jobs                 to service_role;
grant select, insert, update on public.job_engineer_matches  to service_role;

-- ----------------------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------------------
insert into public.job_sources (name, slug, base_url, config)
values (
  'JSearch',
  'jsearch',
  'https://jsearch.p.rapidapi.com',
  '{"query": "software engineer", "work_from_home": true}'::jsonb
);
