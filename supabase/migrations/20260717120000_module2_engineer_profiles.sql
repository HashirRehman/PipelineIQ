-- ============================================================================
-- Module 2 — Engineer Profile Management
-- Tables: seniority_levels, skills, engineers, engineer_skills, engineer_cvs,
--         engineer_bd_assignments, app_settings
-- Depends on: public.profiles, public.is_admin() (Module 1)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: seniority_levels (lookup)
-- ----------------------------------------------------------------------------
create table public.seniority_levels (
  id         uuid primary key default extensions.gen_random_uuid(),
  name       text not null,
  rank       smallint not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint seniority_levels_name_key unique (name),
  constraint seniority_levels_rank_key unique (rank)
);

comment on table public.seniority_levels is
  'Admin-managed lookup of seniority tiers. Extensible without a migration — a new tier is an INSERT.';

-- ----------------------------------------------------------------------------
-- Table: skills (lookup)
-- ----------------------------------------------------------------------------
create table public.skills (
  id         uuid primary key default extensions.gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

comment on table public.skills is
  'Admin-managed, open-ended vocabulary. Case-insensitive uniqueness prevents "React" vs "react" duplicates.';

create unique index skills_name_lower_key on public.skills (lower(name));

-- ----------------------------------------------------------------------------
-- Table: engineers
-- ----------------------------------------------------------------------------
create table public.engineers (
  id                  uuid primary key default extensions.gen_random_uuid(),
  full_name           text not null,
  email               text not null,
  phone               text,
  location            text,
  seniority_level_id  uuid not null references public.seniority_levels (id),
  years_experience    numeric(4,1) check (years_experience >= 0),
  rate_expectation    numeric(10,2) check (rate_expectation >= 0),
  rate_currency       char(3) not null default 'USD',
  summary             text,
  is_active           boolean not null default true,
  created_by          uuid not null references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint engineers_email_key unique (email)
);

comment on table public.engineers is
  'Core engineer roster. Never hard-deleted — is_active=false just excludes from discovery while preserving history.';
comment on column public.engineers.is_active is
  'false = hidden from Module 3 discovery matching only. All history (leads, CVs, assignments) stays intact.';

create index idx_engineers_is_active on public.engineers (is_active);
create index idx_engineers_seniority_level_id on public.engineers (seniority_level_id);

create trigger set_engineers_updated_at
before update on public.engineers
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: engineer_skills (junction)
-- ----------------------------------------------------------------------------
create table public.engineer_skills (
  engineer_id uuid not null references public.engineers (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete restrict,
  proficiency smallint check (proficiency between 1 and 5),
  primary key (engineer_id, skill_id)
);

comment on table public.engineer_skills is
  'N:M engineers<->skills. Mutated only by Admin as part of editing an engineer''s core details.';

create index idx_engineer_skills_skill_id on public.engineer_skills (skill_id);

-- ----------------------------------------------------------------------------
-- Table: engineer_cvs (append-only, versioned)
-- ----------------------------------------------------------------------------
create table public.engineer_cvs (
  id               uuid primary key default extensions.gen_random_uuid(),
  engineer_id      uuid not null references public.engineers (id),
  label            text not null,
  storage_path     text not null,
  file_name        text not null,
  mime_type        text not null check (mime_type in (
                     'application/pdf',
                     'application/msword',
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                   )),
  file_size_bytes  integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  is_current       boolean not null default true,
  uploaded_by      uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  constraint engineer_cvs_storage_path_key unique (storage_path)
);

comment on table public.engineer_cvs is
  'Versioned CV history — never overwritten or deleted. is_current is trigger-maintained: exactly one true row per engineer.';
comment on column public.engineer_cvs.file_size_bytes is
  '10MB is a hard DB-level ceiling. The real, Admin-tunable default (app_settings.cv_max_file_size_bytes) is enforced by the upload Edge Function before this row is ever inserted.';

create unique index idx_engineer_cvs_engineer_id_current
  on public.engineer_cvs (engineer_id)
  where is_current;

-- Keeps "one current CV per engineer" a real invariant, not just a
-- trigger-maintained convention — same philosophy as the duplicate-lead
-- partial unique index planned for Module 4.

create or replace function public.set_current_engineer_cv()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.engineer_cvs
  set is_current = false
  where engineer_id = new.engineer_id
    and is_current = true;
  new.is_current = true;
  return new;
end;
$$;

comment on function public.set_current_engineer_cv() is
  'Before-insert trigger on engineer_cvs: unsets is_current on the engineer''s prior CVs, forces it true on the new row.';

create trigger set_current_engineer_cv
before insert on public.engineer_cvs
for each row
execute function public.set_current_engineer_cv();

-- ----------------------------------------------------------------------------
-- Table: engineer_bd_assignments (time-ranged history)
-- ----------------------------------------------------------------------------
create table public.engineer_bd_assignments (
  id             uuid primary key default extensions.gen_random_uuid(),
  engineer_id    uuid not null references public.engineers (id),
  bd_user_id     uuid not null references public.profiles (id),
  assigned_by    uuid not null references public.profiles (id),
  assigned_at    timestamptz not null default now(),
  unassigned_at  timestamptz,
  constraint engineer_bd_assignments_unassigned_after_assigned
    check (unassigned_at is null or unassigned_at > assigned_at)
);

comment on table public.engineer_bd_assignments is
  'Reassignment = close old row (unassigned_at = now()) + insert new row. Never mutate a closed row. Supports multiple simultaneous BDs per engineer.';

create unique index engineer_bd_assignments_active_pair_key
  on public.engineer_bd_assignments (engineer_id, bd_user_id)
  where unassigned_at is null;

create index idx_engineer_bd_assignments_bd_user_id_active
  on public.engineer_bd_assignments (bd_user_id)
  where unassigned_at is null;

create index idx_engineer_bd_assignments_engineer_id_active
  on public.engineer_bd_assignments (engineer_id)
  where unassigned_at is null;

-- ----------------------------------------------------------------------------
-- Table: app_settings
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is
  'Small Admin-tunable config table so operational limits (e.g. CV size cap) aren''t hardcoded.';

create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Function: assigned_engineer_ids()
-- ----------------------------------------------------------------------------
create or replace function public.assigned_engineer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select engineer_id
  from public.engineer_bd_assignments
  where bd_user_id = auth.uid()
    and unassigned_at is null;
$$;

comment on function public.assigned_engineer_ids() is
  'SECURITY DEFINER helper. Engineer IDs currently assigned to auth.uid(). Every non-Admin engineer-visibility policy composes from this, same as is_admin().';

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.seniority_levels        enable row level security;
alter table public.skills                  enable row level security;
alter table public.engineers                enable row level security;
alter table public.engineer_skills          enable row level security;
alter table public.engineer_cvs             enable row level security;
alter table public.engineer_bd_assignments  enable row level security;
alter table public.app_settings             enable row level security;

-- seniority_levels — Admin-managed lookup, everyone reads -------------------
create policy seniority_levels_select on public.seniority_levels
for select
to authenticated
using (true);

create policy seniority_levels_insert on public.seniority_levels
for insert
to authenticated
with check (public.is_admin());

create policy seniority_levels_update on public.seniority_levels
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy seniority_levels_delete on public.seniority_levels
for delete
to authenticated
using (public.is_admin());

-- skills — Admin-managed lookup, everyone reads ------------------------------
create policy skills_select on public.skills
for select
to authenticated
using (true);

create policy skills_insert on public.skills
for insert
to authenticated
with check (public.is_admin());

create policy skills_update on public.skills
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy skills_delete on public.skills
for delete
to authenticated
using (public.is_admin());

-- engineers ------------------------------------------------------------------
create policy engineers_select on public.engineers
for select
to authenticated
using (public.is_admin() or id in (select public.assigned_engineer_ids()));

create policy engineers_insert on public.engineers
for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy engineers_update on public.engineers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Deliberately no DELETE policy: engineers are never hard-deleted.

-- engineer_skills — visibility follows the engineer, mutation is Admin-only -
create policy engineer_skills_select on public.engineer_skills
for select
to authenticated
using (
  public.is_admin()
  or engineer_id in (select public.assigned_engineer_ids())
);

create policy engineer_skills_insert on public.engineer_skills
for insert
to authenticated
with check (public.is_admin());

create policy engineer_skills_update on public.engineer_skills
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy engineer_skills_delete on public.engineer_skills
for delete
to authenticated
using (public.is_admin());

-- engineer_cvs — Admin + assigned BD can both view and upload ---------------
create policy engineer_cvs_select on public.engineer_cvs
for select
to authenticated
using (
  public.is_admin()
  or engineer_id in (select public.assigned_engineer_ids())
);

create policy engineer_cvs_insert on public.engineer_cvs
for insert
to authenticated
with check (
  (public.is_admin() or engineer_id in (select public.assigned_engineer_ids()))
  and uploaded_by = auth.uid()
);

-- Deliberately no UPDATE/DELETE policy: append-only, never overwritten.

-- engineer_bd_assignments — Admin-only mutation; visibility follows current
-- assignment only, per "no visibility after unassignment" (doc 01 sec. 9) --
create policy engineer_bd_assignments_select on public.engineer_bd_assignments
for select
to authenticated
using (
  public.is_admin()
  or engineer_id in (select public.assigned_engineer_ids())
);

create policy engineer_bd_assignments_insert on public.engineer_bd_assignments
for insert
to authenticated
with check (public.is_admin() and assigned_by = auth.uid());

create policy engineer_bd_assignments_update on public.engineer_bd_assignments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Deliberately no DELETE policy: history rows are closed, never removed.

-- app_settings — Admin-managed, everyone reads tunables ----------------------
create policy app_settings_select on public.app_settings
for select
to authenticated
using (true);

create policy app_settings_insert on public.app_settings
for insert
to authenticated
with check (public.is_admin());

create policy app_settings_update on public.app_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy app_settings_delete on public.app_settings
for delete
to authenticated
using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
revoke all on public.seniority_levels       from anon, authenticated;
revoke all on public.skills                 from anon, authenticated;
revoke all on public.engineers               from anon, authenticated;
revoke all on public.engineer_skills         from anon, authenticated;
revoke all on public.engineer_cvs            from anon, authenticated;
revoke all on public.engineer_bd_assignments from anon, authenticated;
revoke all on public.app_settings            from anon, authenticated;

-- anon gets nothing on any Module 2 table.

grant select, insert, update, delete on public.seniority_levels to authenticated;
grant select, insert, update, delete on public.skills to authenticated;

grant select, insert, update on public.engineers to authenticated;
-- No delete grant, to any role, ever — engineers are never hard-deleted.

grant select, insert, update, delete on public.engineer_skills to authenticated;

grant select, insert on public.engineer_cvs to authenticated;
-- No update/delete grant, to any role, ever — append-only.

grant select, insert, update on public.engineer_bd_assignments to authenticated;
-- No delete grant — history rows are closed via update, never removed.

grant select, insert, update, delete on public.app_settings to authenticated;

-- ----------------------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------------------
insert into public.seniority_levels (name, rank)
values
  ('Junior', 1),
  ('Mid', 2),
  ('Senior', 3),
  ('Lead', 4);

insert into public.app_settings (key, value, description)
values
  ('cv_max_file_size_bytes', '5242880'::jsonb,
   'Admin-tunable CV upload size cap in bytes, enforced by the upload Edge Function. The 10MB CHECK on engineer_cvs.file_size_bytes is a separate, hard DB-level ceiling.'),
  ('cv_allowed_mime_types',
   '["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]'::jsonb,
   'Mirrors the CHECK constraint on engineer_cvs.mime_type — kept in sync manually since one is DB-enforced and the other is Admin-tunable.');

-- ============================================================================
-- Storage: cv-files bucket
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('cv-files', 'cv-files', false)
on conflict (id) do nothing;

-- Path convention: cv-files/{engineer_id}/{cv_id}-{original_filename}
-- storage.foldername(name) returns the path segments before the filename,
-- so (storage.foldername(name))[1] is the {engineer_id} segment.

create policy cv_files_select on storage.objects
for select
to authenticated
using (
  bucket_id = 'cv-files'
  and (
    public.is_admin()
    or (storage.foldername(name))[1]::uuid in (select public.assigned_engineer_ids())
  )
);

create policy cv_files_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cv-files'
  and (
    public.is_admin()
    or (storage.foldername(name))[1]::uuid in (select public.assigned_engineer_ids())
  )
);

-- Deliberately no UPDATE/DELETE storage policy for cv-files: mirrors
-- engineer_cvs' append-only rule at the storage layer too — a new version
-- is always a new object at a new {cv_id}-prefixed path, never an overwrite.
