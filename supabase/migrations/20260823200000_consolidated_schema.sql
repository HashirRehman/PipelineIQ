-- =============================================================================
-- CONSOLIDATED SCHEMA — final end-state as of 2026-08-23.
--
-- This file replaces the 35 incremental migrations that previously built up
-- this schema (20260806104621_init_core_tables.sql through
-- 20260823085325_pipeline_stage_state.sql). It is NOT a replay of history —
-- it is the final shape those migrations converge to, written directly.
-- The old migration files are left in place for reference; this file and its
-- two companions (20260823200001_consolidated_auth_and_grants.sql,
-- 20260823200002_consolidated_storage.sql) are meant to be the only
-- migrations replayed against a freshly reset database.
--
-- Contents: extensions, enum types, tables (final columns/constraints/FKs),
-- indexes, the updated_at trigger function + its per-table triggers, the
-- last-active-admin guard trigger, and the user_activities append-only
-- guard trigger. Auth-hook / grants / storage are in the two companion files.
--
-- ROW LEVEL SECURITY IS INTENTIONALLY DISABLED EVERYWHERE IN THIS FILE.
-- Per explicit product decision, this project enforces access control at the
-- backend/API layer (Next.js Route Handlers), not via Postgres RLS. No
-- `enable row level security`, `create policy`, `alter policy`, or
-- `drop policy` statement appears anywhere in this file, and none should be
-- added back for any public-schema table. (Historically, RLS was enabled,
-- then progressively scoped for multi-tenancy, then partly disabled again on
-- catalog tables across the old migrations — see git history of the old
-- files if that lineage is ever needed. The functions that existed only to
-- back RLS policies — is_admin(), is_bd_manager(), current_org_id(),
-- is_admin_in(), is_privileged_in() — are deliberately NOT recreated here:
-- grep across all 35 old migrations confirms every call site was inside a
-- CREATE POLICY / comment, none are called from application code or from
-- custom_access_token_hook / handle_new_user, so they would be dead code.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
create type public.application_status as enum ('suggested', 'dismissed', 'applied');
create type public.job_engagement_type as enum ('inbound', 'outbound');

-- -----------------------------------------------------------------------------
-- Trigger helper: keeps updated_at current on any row update.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- organizations — tenant/company record. Single-tenant in practice today,
-- but organization_id is threaded through every business table.
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  -- Restricts user invitations to this email domain; null/empty = any domain.
  allowed_email_domain  text default 'recursolabs.com'
);

comment on column public.organizations.allowed_email_domain is
  'Allowed email domain for user invitations (e.g. recursolabs.com). NULL or empty allows any domain.';

-- -----------------------------------------------------------------------------
-- pipeline_stages — catalog of stages a lead can sit in.
-- -----------------------------------------------------------------------------
create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  order_index integer not null,
  created_at  timestamptz not null default now(),
  state       text not null default 'active'
    check (state in ('active', 'paused', 'closed')),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- roles — catalog of user roles (Admin, BD Manager, Business Developer, ...).
-- -----------------------------------------------------------------------------
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- users — app-side identity, mirrors auth.users 1:1, carries role + org.
-- -----------------------------------------------------------------------------
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role_id         uuid not null references public.roles(id) on delete restrict,
  full_name       text not null,
  email           text not null unique,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- seniority_level — catalog of profile seniority levels.
-- -----------------------------------------------------------------------------
create table public.seniority_level (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- profiles — candidate roster entries. A user may own multiple profiles;
-- each profile belongs to at most one user (no unique constraint on user_id).
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id),
  user_id             uuid references public.users(id) on delete set null,
  full_name           text not null,
  email               text not null,
  phone               text,
  location            text,
  seniority_level_id  uuid references public.seniority_level(id),
  years_of_experience numeric(4,1) check (years_of_experience >= 0),
  rate_expectation    numeric(10,2) check (rate_expectation >= 0),
  rate_currency       char(3) not null default 'USD',
  rate_unit           text,
  summary             text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- -----------------------------------------------------------------------------
-- profile_cvs — uploaded CV files + their structured AI-parsed content.
-- Files live in Supabase Storage (see the storage consolidated migration);
-- storage_path is the object key, not a URL.
-- -----------------------------------------------------------------------------
create table public.profile_cvs (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  storage_path          text not null,
  file_name             text not null,
  file_type             text not null
    check (file_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )),
  file_size_bytes       bigint not null
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  -- Structured parse of the CV contents (skills, experience, education, ...).
  parsed_data           jsonb,
  parsed_at             timestamptz,
  parse_status          text not null default 'pending'
    check (parse_status in ('pending', 'success', 'failed')),
  parse_error           text,
  parse_model_version   text,
  parse_schema_version  integer,
  constraint profile_cvs_parsed_data_present_on_success check (
    parse_status <> 'success'
    or (parsed_data is not null and parsed_at is not null and parse_schema_version is not null)
  )
);

create unique index profile_cvs_storage_path_key on public.profile_cvs (storage_path);

-- -----------------------------------------------------------------------------
-- scrapers — job sources (including the synthetic "Manual" source used by
-- the New Job flow).
-- -----------------------------------------------------------------------------
create table public.scrapers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  base_url   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- -----------------------------------------------------------------------------
-- cron_run_locks — single-row lock table guarding the nightly discovery job
-- from overlapping runs. Written only by the service-role cron client.
-- -----------------------------------------------------------------------------
create table public.cron_run_locks (
  id                uuid primary key default gen_random_uuid(),
  is_running        boolean not null default false,
  started_at        timestamptz,
  last_completed_at timestamptz,
  updated_at        timestamptz not null default now()
);

-- Seed the fixed lock row the discovery cron (lib/cron/discover-jobs.ts)
-- looks up by a hardcoded id.
insert into public.cron_run_locks (id, is_running)
values ('00000000-0000-4000-8000-000000000090', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- jobs — scraped or manually-entered job postings.
-- -----------------------------------------------------------------------------
create table public.jobs (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id),
  scraper_id             uuid not null references public.scrapers(id),
  external_job_id        text not null,
  title                  text not null,
  company_name           text not null,
  company_location       text,
  description            text,
  apply_url              text not null,
  is_remote              boolean,
  remote_allowed_region  text,
  job_posted_at          timestamptz,
  created_at             timestamptz not null default now(),
  is_globally_open       boolean,
  possibly_closed        boolean not null default false,
  possibly_closed_reason text,
  -- Free-form AI-parse bucket (e.g. manual-job "source"/"budget" extras).
  parsed_data            jsonb,
  -- How the job reached us: inbound (client approached us) vs outbound (we
  -- applied). Null = unclassified.
  engagement_type        public.job_engagement_type,
  -- Column names a user has hand-edited; the nightly discovery cron will not
  -- overwrite these on its next upsert.
  manual_overrides       text[] not null default '{}',
  constraint jobs_scraper_external_key unique (scraper_id, external_job_id),
  constraint jobs_manual_overrides_known_columns check (
    manual_overrides <@ array[
      'title',
      'company_name',
      'company_location',
      'description',
      'apply_url',
      'is_remote',
      'job_posted_at'
    ]::text[]
  )
);

comment on column public.jobs.manual_overrides is
  'Column names edited by a user; the discovery cron will not overwrite these.';
comment on column public.jobs.engagement_type is
  'How the job reached us: inbound = client approached us, outbound = we applied. Null = unclassified (all scraped jobs, and manual jobs where the user left it blank).';

-- Seed the synthetic "Manual" scraper used by hand-added jobs.
insert into public.scrapers (id, name, base_url)
values ('10000000-0000-4000-8000-000000000031', 'Manual', '')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- job_profile_matches — AI relevance scores linking a job to a profile's CV.
-- -----------------------------------------------------------------------------
create table public.job_profile_matches (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  job_id           uuid not null references public.jobs(id),
  profile_id       uuid not null references public.profiles(id),
  cv_id            uuid not null references public.profile_cvs(id),
  relevance_score  numeric(5,2) not null check (relevance_score >= 0 and relevance_score <= 100),
  ai_model_version text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint job_profile_matches_job_profile_cv_key unique (job_id, profile_id, cv_id)
);

-- -----------------------------------------------------------------------------
-- job_profile_states — per (job, profile) application state: the discovery
-- feed's suggested/dismissed/applied lifecycle. Lazily created on first
-- user action (mark-applied / dismiss).
-- -----------------------------------------------------------------------------
create table public.job_profile_states (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  job_id           uuid not null references public.jobs(id),
  profile_id       uuid not null references public.profiles(id),
  status           public.application_status not null default 'suggested',
  user_id          uuid references public.users(id) on delete set null,
  cv_id            uuid references public.profile_cvs(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  dismissed_reason text
);

create unique index job_profile_states_one_live_per_pair
  on public.job_profile_states (job_id, profile_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- leads — an application in flight: a profile applied to a job via a user,
-- tracked through pipeline_stages. user_id is a permanent ownership
-- snapshot of the applier and is nullable (unlinked, not cascaded, when the
-- user is deleted). developer is a lead-specific attribute (not the job's).
-- -----------------------------------------------------------------------------
create table public.leads (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id),
  job_id               uuid not null references public.jobs(id),
  profile_id           uuid not null references public.profiles(id),
  job_profile_state_id uuid references public.job_profile_states(id),
  user_id              uuid references public.users(id) on delete set null,
  pipeline_stage_id    uuid not null references public.pipeline_stages(id),
  applied_at           timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  -- Applier's Notes: written only by the user whose assigned profile was
  -- used to apply (enforced at the API/backend layer).
  notes                text not null default '',
  -- The developer handling this lead (lead-specific: a job may have many
  -- leads, one per applying profile).
  developer            text
);

comment on column public.leads.developer is
  'The developer handling this lead. Lead-specific: a job may have many leads (one per applying profile).';

-- -----------------------------------------------------------------------------
-- job_comments — flat, org-wide discussion thread on a job. No replies.
-- Soft-deleted so history survives; the app hides deleted rows.
-- -----------------------------------------------------------------------------
create table public.job_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint job_comments_body_length check (char_length(btrim(body)) between 1 and 2000)
);

-- -----------------------------------------------------------------------------
-- audit_logs — security / team-management trail (logins, invites, role and
-- status changes, deletions). Admin-read-only, append-only by convention
-- (enforced at the backend layer since RLS is not used here).
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_user_id   uuid references public.users(id) on delete set null,
  action          text not null,
  target_user_id  uuid references public.users(id) on delete set null,
  target_email    text,
  ip_address      text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- user_activities — the org's product activity feed (profiles/jobs/leads/
-- CVs/comments actions). Deliberately separate from audit_logs (wider
-- audience, product feed rather than security trail). Append-only, enforced
-- by triggers below (not RLS): triggers fire regardless of role, including
-- service_role and TRUNCATE, so history cannot be rewritten even though RLS
-- itself is not used to gate access here.
-- -----------------------------------------------------------------------------
create table public.user_activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id         uuid references public.users(id) on delete set null,
  actor_name      text not null,
  action          text not null,
  entity_type     text,
  entity_id       uuid,
  entity_label    text,
  description     text not null,
  metadata        jsonb not null default '{}'::jsonb,
  ip_address      text,
  created_at      timestamptz not null default now(),

  constraint user_activities_action_format
    check (action ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint user_activities_description_length
    check (char_length(btrim(description)) between 1 and 500),
  constraint user_activities_actor_name_length
    check (char_length(btrim(actor_name)) between 1 and 200),
  constraint user_activities_entity_label_length
    check (entity_label is null or char_length(entity_label) <= 300),
  constraint user_activities_entity_type_present
    check (entity_id is null or entity_type is not null)
);

-- =============================================================================
-- Indexes
-- =============================================================================
create index idx_users_organization_id on public.users(organization_id);
create index idx_users_role_id on public.users(role_id);

create index idx_profiles_organization_id on public.profiles(organization_id);
create index idx_profiles_seniority_level_id on public.profiles(seniority_level_id);
create index idx_profiles_is_active on public.profiles(is_active);
create index idx_profiles_user_id on public.profiles (user_id);
-- Unique only among live rows, so archiving a profile (deleted_at) frees its
-- email for reuse by a new profile instead of permanently blocking it.
create unique index profiles_email_key on public.profiles (email) where deleted_at is null;

create index idx_profile_cvs_profile_id on public.profile_cvs(profile_id);
create index idx_profile_cvs_parse_status_pending
  on public.profile_cvs (parse_status)
  where parse_status <> 'success';

create index idx_jobs_organization_id on public.jobs(organization_id);
create index idx_jobs_scraper_id on public.jobs(scraper_id);
create index idx_jobs_engagement_type
  on public.jobs (organization_id, engagement_type)
  where engagement_type is not null;

create index idx_leads_organization_id on public.leads(organization_id);
create index idx_leads_job_id on public.leads(job_id);
create index idx_leads_profile_id on public.leads(profile_id);
create index idx_leads_user_id on public.leads(user_id);
create index idx_leads_pipeline_stage_id on public.leads(pipeline_stage_id);
create index idx_leads_applied_at on public.leads(applied_at);
create index idx_leads_job_profile_state_id on public.leads(job_profile_state_id);

create index idx_job_profile_matches_job_id on public.job_profile_matches(job_id);
create index idx_job_profile_matches_profile_id on public.job_profile_matches(profile_id);
create index idx_job_profile_matches_cv_id on public.job_profile_matches(cv_id);

create index idx_job_profile_states_job_id on public.job_profile_states(job_id);
create index idx_job_profile_states_profile_id on public.job_profile_states(profile_id);
create index idx_job_profile_states_user_id on public.job_profile_states(user_id);
create index idx_job_profile_states_cv_id on public.job_profile_states(cv_id);
create index idx_job_profile_states_status on public.job_profile_states(status);
-- app/api/discovery/route.ts filters this table by organization_id alone.
create index idx_job_profile_states_organization_id on public.job_profile_states(organization_id);

create index idx_job_comments_job_id on public.job_comments(job_id);
create index idx_job_comments_organization_id on public.job_comments(organization_id);
create index idx_job_comments_user_id on public.job_comments(user_id);

create index idx_audit_logs_org_created on public.audit_logs (organization_id, created_at desc);
create index idx_audit_logs_action on public.audit_logs (action);

create index idx_user_activities_org_created
  on public.user_activities (organization_id, created_at desc);
create index idx_user_activities_user_created
  on public.user_activities (user_id, created_at desc);
create index idx_user_activities_action
  on public.user_activities (action);
create index idx_user_activities_entity
  on public.user_activities (entity_type, entity_id)
  where entity_id is not null;

-- =============================================================================
-- Triggers: updated_at maintenance
-- =============================================================================
create trigger update_organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at_column();

create trigger update_users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at_column();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_profile_cvs_updated_at
  before update on public.profile_cvs
  for each row execute function public.update_updated_at_column();

create trigger update_scrapers_updated_at
  before update on public.scrapers
  for each row execute function public.update_updated_at_column();

create trigger update_cron_run_locks_updated_at
  before update on public.cron_run_locks
  for each row execute function public.update_updated_at_column();

create trigger update_leads_updated_at
  before update on public.leads
  for each row execute function public.update_updated_at_column();

create trigger update_job_profile_matches_updated_at
  before update on public.job_profile_matches
  for each row execute function public.update_updated_at_column();

create trigger update_job_profile_states_updated_at
  before update on public.job_profile_states
  for each row execute function public.update_updated_at_column();

create trigger update_job_comments_updated_at
  before update on public.job_comments
  for each row execute function public.update_updated_at_column();

create trigger update_pipeline_stages_updated_at
  before update on public.pipeline_stages
  for each row execute function public.update_updated_at_column();

-- =============================================================================
-- Trigger: guard_last_active_admin
--
-- Hard database-level guarantee that an organization can never end up with
-- zero active Admins, independent of RLS/backend enforcement. Blocks any
-- UPDATE or DELETE on public.users that would demote/deactivate/delete the
-- last active Admin in an org, or move them to a different org.
-- =============================================================================
create or replace function public.guard_last_active_admin()
returns trigger
language plpgsql
set search_path = public
security definer
as $$
declare
  still_admin boolean;
  other_admins int;
begin
  if not (
    old.is_active
    and old.deleted_at is null
    and exists (
      select 1 from public.roles r
      where r.id = old.role_id and r.name = 'Admin'
    )
  ) then
    return coalesce(new, old);
  end if;

  select count(*) into other_admins
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.organization_id = old.organization_id
    and u.is_active
    and u.deleted_at is null
    and r.name = 'Admin'
    and u.id <> old.id;

  if other_admins > 0 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Cannot remove the last active Admin in the organization. Promote another member to Admin first.';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Cannot move the last active Admin to another organization. Promote a replacement Admin in the current organization first.';
  end if;

  select (
    new.is_active
    and new.deleted_at is null
    and exists (
      select 1 from public.roles r
      where r.id = new.role_id and r.name = 'Admin'
    )
  ) into still_admin;

  if not still_admin then
    raise exception 'Cannot demote or deactivate the last active Admin in the organization. Promote another member to Admin first.';
  end if;

  return new;
end;
$$;

-- Split into two triggers rather than one combined UPDATE-OR-DELETE trigger:
-- a single WHEN clause cannot reference NEW for a trigger that also fires on
-- DELETE (NEW does not exist for that event), so the "skip irrelevant column
-- updates" condition below only applies to the UPDATE trigger.
create trigger guard_last_active_admin_on_delete
  before delete on public.users
  for each row execute function public.guard_last_active_admin();

create trigger guard_last_active_admin_on_update
  before update on public.users
  for each row
  when (
    old.is_active is distinct from new.is_active or
    old.deleted_at is distinct from new.deleted_at or
    old.role_id is distinct from new.role_id or
    old.organization_id is distinct from new.organization_id
  )
  execute function public.guard_last_active_admin();

-- =============================================================================
-- Trigger: user_activities append-only guard
--
-- Blocks UPDATE/DELETE (row-level) and TRUNCATE (statement-level) on
-- user_activities for every role, including service_role — the only
-- guarantee that actually cannot be bypassed by grants.
-- =============================================================================
create or replace function public.prevent_user_activity_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception
    'public.user_activities is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger user_activities_no_update_delete
  before update or delete on public.user_activities
  for each row execute function public.prevent_user_activity_mutation();

create trigger user_activities_no_truncate
  before truncate on public.user_activities
  for each statement execute function public.prevent_user_activity_mutation();
