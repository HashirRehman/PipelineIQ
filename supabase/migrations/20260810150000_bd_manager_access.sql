-- BD Manager role: read-only access to the Users page (the team roster).
--
-- Permission model (matching the app's role-based gates):
--   * Admin              — everything, including inviting users.
--   * BD Manager         — ONLY the Users list (view the team, nothing else).
--   * Business Developer — no Users / Profiles pages; sees the job pages
--                          (Discovery / Pipeline / Leads / Statistics).
--
-- The only change this migration makes to RLS is widening `users_select` so
-- a BD Manager can read every team member (originally admin-or-self). Every
-- other table keeps its original admin-or-owner policy from migration 7 —
-- a BD Manager sees no profiles, CVs, match scores, application states,
-- leads, or comments. `users_update` / `users_delete` stay admin-only (the
-- BD Manager is a viewer, not a manager), and `users_insert` (invite)
-- remains admin-only, so invites are blocked even at the DB level.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

create or replace function public.is_bd_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'BD Manager'
      and u.deleted_at is null
  );
$$;

grant execute on function public.is_bd_manager to authenticated, service_role;

-- Users: BD Managers may read every team member (view-only). Updates and
-- deletes remain admin-only (policies from migrations 7/9/13 unchanged).
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (is_admin() or is_bd_manager() or id = auth.uid());
