-- Fix handle_new_user()'s dead role lookup — unrelated bug, found while
-- creating test accounts for a different change, worth fixing separately
-- since it currently breaks account creation entirely.
--
-- The trigger has always looked up a role named 'User' to assign to a
-- freshly-created auth user, but no role of that name has ever existed in
-- this schema (roles: 'Admin', 'BD Manager', 'Business Developer' — see
-- supabase/seed.sql and migration 15/16). The lookup silently resolved to
-- NULL, which was harmless while users.role_id was nullable — the insert
-- just landed with no role, same as before this trigger existed.
--
-- 20260818110241_make_role_id_not_null.sql made role_id NOT NULL. Since that
-- migration, this trigger's insert into public.users violates the NOT NULL
-- constraint on every single new auth.users row, which fails the whole
-- transaction — auth.admin.createUser / inviteUserByEmail now return
-- "Database error creating new user" for every account, including real
-- invites through POST /api/users.
--
-- Fixed to 'Business Developer' — the lowest-privilege usable role, matching
-- the fallback getRolePermissions() already uses in lib/auth/roles.ts for an
-- unassigned/unrecognized role. app/api/users/route.ts's invite flow
-- immediately upserts the real chosen role right after this trigger fires,
-- so this only matters for the brief window between auth.users insert and
-- that upsert (and for any auth.users row that never gets a follow-up
-- upsert, which now safely defaults to the least-privileged role instead of
-- failing outright).
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org_id uuid;
  v_role_id uuid;
begin
  select id into v_org_id
  from public.organizations
  where is_active = true and deleted_at is null
  order by created_at
  limit 1;

  -- No organization configured yet — skip; app code will create the row later.
  if v_org_id is null then
    return new;
  end if;

  select id into v_role_id
  from public.roles
  where name = 'Business Developer'
  limit 1;

  insert into public.users (id, organization_id, role_id, full_name, email, is_active)
  values (
    new.id,
    v_org_id,
    v_role_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    true
  )
  on conflict do nothing;

  return new;
end;
$function$;
