-- ============================================================================
-- Module 1 — Authentication & User Management
-- Tables: roles, profiles, user_roles, login_history
-- Depends on: auth.users (Supabase-managed)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Table: roles (lookup)
-- ----------------------------------------------------------------------------
create table public.roles (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  constraint roles_name_key unique (name)
);

comment on table public.roles is
  'Lookup table of assignable roles (admin, bd_executive, ...). A new role is an INSERT, never a schema change.';

-- ----------------------------------------------------------------------------
-- Table: profiles (1:1 extension of auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_key unique (email)
);

comment on table public.profiles is
  'App-level identity extension of auth.users. Auto-created by trigger when Admin invites a new user.';
comment on column public.profiles.is_active is
  'Admin-writable only. Deactivates a login without deleting history.';
comment on column public.profiles.email is
  'Synced from auth.users via trigger on auth.users email change; never written directly.';

-- ----------------------------------------------------------------------------
-- Table: user_roles
-- ----------------------------------------------------------------------------
create table public.user_roles (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  constraint user_roles_user_id_role_id_key unique (user_id, role_id)
);

comment on table public.user_roles is
  'Role assignments (N:M profiles<->roles). assigned_by is null only for the first seeded admin.';

create index idx_user_roles_user_id on public.user_roles (user_id);
create index idx_user_roles_role_id on public.user_roles (role_id);

-- ----------------------------------------------------------------------------
-- Table: login_history (append-only)
-- ----------------------------------------------------------------------------
create table public.login_history (
  id           uuid primary key default extensions.gen_random_uuid(),
  user_id      uuid not null references public.profiles (id),
  logged_in_at timestamptz not null default now(),
  ip_address   inet,
  user_agent   text
);

comment on table public.login_history is
  'Append-only sign-in log. No UPDATE/DELETE grants to any app role, ever.';

create index idx_login_history_user_id_logged_in_at
  on public.login_history (user_id, logged_in_at desc);

-- ----------------------------------------------------------------------------
-- Function: is_admin()
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = 'admin'
  );
$$;

comment on function public.is_admin() is
  'SECURITY DEFINER helper. True if the current auth.uid() holds the admin role. Every RLS policy composes from this.';

-- ----------------------------------------------------------------------------
-- Function: set_updated_at() — generic, reusable by later modules
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic before-update trigger: stamps updated_at = now(). Reused by every mutable table across all modules.';

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: auth.users -> profiles (auto-create on invite)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Fires after insert on auth.users. Creates the matching profiles row. full_name comes from raw_user_meta_data, set by the invite Server Action; coalesced to empty string only as a safety net.';

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Trigger: auth.users -> profiles (email sync)
-- ----------------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

comment on function public.sync_profile_email() is
  'Fires after update of email on auth.users. Keeps profiles.email in sync per the "synced from auth.users via trigger" column spec.';

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.roles         enable row level security;
alter table public.user_roles    enable row level security;
alter table public.login_history enable row level security;

-- profiles ---------------------------------------------------------------
create policy profiles_select on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- roles --------------------------------------------------------------------
create policy roles_select on public.roles
for select
to authenticated
using (true);

create policy roles_insert on public.roles
for insert
to authenticated
with check (public.is_admin());

create policy roles_update on public.roles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy roles_delete on public.roles
for delete
to authenticated
using (public.is_admin());

-- user_roles -----------------------------------------------------------
create policy user_roles_select on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy user_roles_insert on public.user_roles
for insert
to authenticated
with check (public.is_admin());

create policy user_roles_update on public.user_roles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy user_roles_delete on public.user_roles
for delete
to authenticated
using (public.is_admin());

-- login_history ----------------------------------------------------------
create policy login_history_select on public.login_history
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy login_history_insert on public.login_history
for insert
to authenticated
with check (user_id = auth.uid());

-- Deliberately no UPDATE/DELETE policy: append-only. No policy = default
-- deny, reinforced by the absence of any UPDATE/DELETE grant below.

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
revoke all on public.profiles      from anon, authenticated;
revoke all on public.roles         from anon, authenticated;
revoke all on public.user_roles    from anon, authenticated;
revoke all on public.login_history from anon, authenticated;

-- anon gets nothing on any Module 1 table.

grant select on public.profiles to authenticated;
grant update (full_name, is_active) on public.profiles to authenticated;
-- id/email/created_at/updated_at are never client-writable; email is
-- trigger-synced only, updated_at is trigger-stamped only.

grant select, insert, update, delete on public.roles to authenticated;

grant select, insert, update, delete on public.user_roles to authenticated;

grant select, insert on public.login_history to authenticated;
-- No update/delete grant, to any role, ever.

-- ----------------------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------------------
insert into public.roles (name, description)
values
  ('admin', 'Full administrative access: manages users, roles, and configurable lookup data.'),
  ('bd_executive', 'Business development executive: owns and works assigned leads and engineers.');

-- NOTE: the first admin *user* is intentionally not seeded here — see
-- "Known gap" in the plan. Bootstrapping it is a manual, one-time step:
-- invite the first admin via Supabase Studio, then:
--   insert into public.user_roles (user_id, role_id)
--   select '<their-auth-uid>', id from public.roles where name = 'admin';
