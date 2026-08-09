-- Post-reset hardening (A1, A2 of docs/hardening-fixes-plan.md)
-- 1. Seed the cron run-lock row. The fresh schema made cron_run_locks.id a
--    uuid (was text 'discover-jobs' in the old schema) and seeded nothing, so
--    lib/cron/discover-jobs.ts' CRON_LOCK_ID lookup/update finds no row and the
--    discovery run fails. Fixed uuid below matches the code constant.
insert into public.cron_run_locks (id, is_running)
values ('00000000-0000-4000-8000-000000000090', false)
on conflict (id) do nothing;

-- 2. handle_new_user(): recreate the auth.users -> users auto-create trigger
--    that existed in old Module 1. The fresh schema relied on app code alone,
--    so auth users created outside the app (e.g. Supabase Dashboard) never got
--    a users row -> is_admin() false -> 403s. Inserts with the first active
--    organization and the default 'User' role; on conflict do nothing keeps it
--    idempotent against app-side creation (scripts/createUser.cjs, /api/users).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  where name = 'User'
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
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
