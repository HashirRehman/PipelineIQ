-- Owner protection at the data layer (org best practice: the last owner
-- cannot be removed or demoted — ownership must be transferred first).
--
-- The app already preserves this invariant by construction (the users API
-- blocks self-demotion / self-status-change / self-delete, and only Admins
-- can manage other members), but that is a convention, not a guarantee:
-- a future app change, a direct DB write with a valid admin token, or a
-- cascade (e.g. deleting the 'Admin' role row) could silently leave an
-- organization with zero active Admins and no one able to manage it.
--
-- This trigger makes it a hard database-level guarantee. Any UPDATE or
-- DELETE on public.users that would leave an organization without at least
-- one active Admin is rejected, no matter how it was issued. Promoting a
-- member to Admin first (or having another Admin remain) unblocks it.
--
-- "Active Admin" = a users row with is_active = true, deleted_at null, and
-- a role_id pointing at the 'Admin' role (the same definition the existing
-- is_admin() helper and custom_access_token_hook use). Scoped per
-- organization, so one org's admin set never affects another's.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

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
  -- Only a row that is currently an active Admin can be the "last admin".
  -- SECURITY DEFINER + explicit search_path so the internal count sees the
  -- true row set regardless of the caller's RLS view (same pattern as the
  -- existing is_admin() helper).
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

  -- Count other active Admins in the same org, excluding this row.
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

  -- old is the last active Admin in its org. Deletion is always fatal.
  if tg_op = 'DELETE' then
    raise exception 'Cannot remove the last active Admin in the organization. Promote another member to Admin first.';
  end if;

  -- Moving the last active Admin to another org would also leave the old
  -- org without any Admin. RLS already prevents org changes (users_update's
  -- WITH CHECK pins organization_id to the caller's org), but the guard is
  -- a hard guarantee — block it here too. (new is non-NULL here: the
  -- DELETE branch raised above.)
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Cannot move the last active Admin to another organization. Promote a replacement Admin in the current organization first.';
  end if;

  -- For an UPDATE, block only if the row stops being an active Admin
  -- (role demoted / role_id nulled / deactivated / soft-deleted). Plain
  -- name edits on the last admin remain allowed.
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

-- Trigger functions are invoked by the database itself (no execute grant
-- needed), but mirror the is_admin() grant pattern for explicitness.
grant execute on function public.guard_last_active_admin() to authenticated, service_role;

drop trigger if exists guard_last_active_admin on public.users;

create trigger guard_last_active_admin
  before update or delete on public.users
  for each row execute function public.guard_last_active_admin();
