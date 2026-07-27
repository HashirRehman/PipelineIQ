-- One-time bootstrap: assign the 'admin' role to a manually-invited user.
-- NOT part of supabase/migrations/ — this is a per-environment operational
-- step tied to one real person's email, not a schema change, and must
-- never auto-replay on a fresh clone or teammate setup.
--
-- Prerequisite: invite the user via Supabase Dashboard > Authentication >
-- Users > Invite user first. That fires handle_new_user(), which creates
-- their profiles row automatically (full_name will be blank — the
-- Dashboard invite flow doesn't pass user metadata; fixable later since
-- this user will satisfy is_admin() once this script runs).
--
-- Usage: replace the email below, then run this whole file, e.g.:
--   npx supabase db query --linked --file supabase/bootstrap-admin.sql

do $$
declare
  target_email  text := 'REPLACE_WITH_ADMIN_EMAIL';
  target_user_id uuid;
  admin_role_id  uuid;
begin
  select id into target_user_id from auth.users where email = target_email;
  if target_user_id is null then
    raise exception
      'No auth.users row for %. Invite them via Dashboard > Authentication > Users first.',
      target_email;
  end if;

  select id into admin_role_id from public.roles where name = 'admin';

  insert into public.user_roles (user_id, role_id)
  values (target_user_id, admin_role_id)
  on conflict (user_id, role_id) do nothing;

  raise notice 'Assigned admin role to % (user_id=%)', target_email, target_user_id;
end $$;

-- Verify:
select p.id, p.email, p.full_name, p.is_active, r.name as role
from public.profiles p
join public.user_roles ur on ur.user_id = p.id
join public.roles r on r.id = ur.role_id
where p.email = 'REPLACE_WITH_ADMIN_EMAIL';
