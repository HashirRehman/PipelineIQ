-- Post-reset hardening (B3, B4, B5, C6, C7, E1 of docs/hardening-fixes-plan.md)

-- ---------------------------------------------------------------------------
-- E1: trigger helper — recreate with an explicit search_path (the old
-- set_updated_at() set public, pg_temp; the fresh function omitted it).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- B5: drop anon grants (correct already-seeded DBs; seed.sql is edited to
-- stop granting them going forward). Old schema revoked everything from anon.
-- ---------------------------------------------------------------------------
revoke select on all tables in schema public from anon;
revoke usage on type public.application_status from anon;

-- ---------------------------------------------------------------------------
-- B3: SECURITY DEFINER functions — revoke the default PUBLIC (hence anon)
-- execute and scope grants to the roles that actually call them. (is_admin is
-- the only remaining SECURITY DEFINER function; the discovery RPCs and the
-- email-sync trigger were removed.)
-- ---------------------------------------------------------------------------
revoke execute on function public.is_admin from public, anon;
grant execute on function public.is_admin to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B4: users_update — a non-admin may only edit their own full_name. role_id,
-- organization_id, is_active, deleted_at and email are admin-only, so a user
-- can no longer self-escalate or self-soft-delete at the DB level (old
-- profiles_update was admin-only; the fresh WITH CHECK allowed
-- self-escalation).
-- ---------------------------------------------------------------------------
drop policy users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (is_admin() or id = auth.uid())
  with check (
    is_admin()
    or (
      -- Non-admins may only edit their own full_name. role_id, organization_id,
      -- is_active and deleted_at are admin-only; email is immutable in the app
      -- (set once at invite, no update path — the email-sync trigger was
      -- removed) and must never be writable directly.
      id = auth.uid()
      and role_id is not distinct from (
        select role_id from public.users where id = auth.uid()
      )
      and organization_id is not distinct from (
        select organization_id from public.users where id = auth.uid()
      )
      and is_active is not distinct from (
        select is_active from public.users where id = auth.uid()
      )
      and deleted_at is not distinct from (
        select deleted_at from public.users where id = auth.uid()
      )
      and email is not distinct from (
        select email from public.users where id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- B4: job_profile_states_update — a profile owner may set their own
-- profile's state to 'applied', or to 'dismissed' with a reason (exactly
-- what the mark-applied / dismiss routes do). Admins can update any row.
-- ---------------------------------------------------------------------------
drop policy job_profile_states_update on public.job_profile_states;
create policy job_profile_states_update on public.job_profile_states
  for update to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = profile_id and p.user_id = auth.uid()
      )
      and (
        status = 'applied'
        or (status = 'dismissed' and dismissed_reason is not null)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- C6: profiles.user_id FK — NO ACTION meant deleting an auth user (which
-- cascades auth.users -> users) failed while a profile referenced it. The old
-- schema cascaded profiles from auth.users; here the profile survives and is
-- simply unlinked.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- C7: profile_cvs hardening constraints that existed on the old engineer_cvs
-- (mime whitelist, 10 MB ceiling, unique storage path).
-- ---------------------------------------------------------------------------
alter table public.profile_cvs
  add constraint profile_cvs_file_type_check
  check (file_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ));

alter table public.profile_cvs
  add constraint profile_cvs_file_size_check
  check (file_size_bytes > 0 and file_size_bytes <= 10485760);

create unique index profile_cvs_storage_path_key on public.profile_cvs (storage_path);
