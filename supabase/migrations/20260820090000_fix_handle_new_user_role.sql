-- handle_new_user(): look up the role that actually exists.
--
-- The trigger has looked up a role named 'User' since migration
-- 20260806220000, but that role was renamed to 'Business Developer'. The
-- lookup therefore returns null, and since migration 20260818110241 made
-- users.role_id NOT NULL the insert raises — and because this is an AFTER
-- INSERT trigger on auth.users, the exception aborts the whole transaction.
-- Net effect: creating ANY auth user fails (invites, scripts/createUser.cjs)
-- with an opaque Auth error that never mentions roles.
--
-- 'Business Developer' matches the fallback migration 20260818110241 chose
-- when it backfilled null role_ids, so the two agree on the default.
--
-- The null guard is deliberate: bail out and leave the users row to be
-- created by app code rather than blocking account creation entirely. This
-- fails OPEN on the profile row and CLOSED on privilege (no role = no
-- elevated access), matching the is_admin() convention.
--
-- Additive (function replace only): apply with `npm run migrate:up:*`.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_role_id uuid;
begin
  select id into v_org_id
  from public.organizations
  where is_active = true and deleted_at is null
  order by created_at
  limit 1;

  -- No organization configured yet — skip; app code creates the row later.
  if v_org_id is null then
    return new;
  end if;

  select id into v_role_id
  from public.roles
  where name = 'Business Developer'
  limit 1;

  -- Reference data missing (fresh project, seed not run yet). role_id is NOT
  -- NULL, so skip rather than abort the auth insert.
  if v_role_id is null then
    return new;
  end if;

  insert into public.users (id, organization_id, role_id, full_name, email, is_active)
  values (
    new.id,
    v_org_id,
    v_role_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
