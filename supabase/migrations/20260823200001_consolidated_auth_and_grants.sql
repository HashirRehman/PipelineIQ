-- =============================================================================
-- CONSOLIDATED AUTH INTEGRATION + GRANTS — final end-state as of 2026-08-23.
--
-- Contents:
--   1. custom_access_token_hook — injects is_admin / user_role claims into
--      JWTs. Independent of RLS (it's an Auth hook, not a policy); preserved
--      as-is. Requires `config.toml` to enable it as the access token hook.
--   2. handle_new_user + the on_auth_user_created trigger — auto-creates a
--      public.users row when a new auth.users row is inserted.
--   3. sync_user_email + the on_auth_user_email_updated trigger — keeps
--      public.users.email from drifting when a user's auth email changes.
--   4. Table grants to anon / authenticated / service_role.
--
-- Per product decision, RLS is disabled across the public schema (see
-- 20260823200000_consolidated_schema.sql's header) — access control lives at
-- the backend/API layer instead. Because there is no RLS to filter rows,
-- the GRANTs below intentionally follow a coarser model than the old
-- migrations' "narrow grant + RLS row filter" combination: any table an
-- authenticated user's session is allowed to touch through the app gets the
-- verbs the app uses, matching what the app's Route Handlers already assume
-- (they were built and reviewed against the final grant shape from
-- 20260812110000_trim_rls_to_tenant_tables.sql /
-- 20260812120000_close_anon_grants.sql / 20260818090000_jobs_update_grant.sql).
-- Every table's real access boundary must now be enforced in the API layer
-- (Route Handlers under app/api/*) — a GRANT alone no longer implies "any
-- row", but it also no longer implies "only the caller's rows" the way it
-- did under RLS. Treat these grants as "the verbs the backend is allowed to
-- issue with the authenticated client", not as a security boundary by
-- themselves.
--
-- anon gets NO grants on any public table (unchanged from the old
-- migrations' posture — anon was never a supported access path here).
-- service_role keeps full, unrestricted access to every table (cron +
-- admin path); this was true even before, since service_role bypasses RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. custom_access_token_hook — injects is_admin / user_role claims into
--    JWTs. middleware.ts + getCachedIsAdmin() read the is_admin claim to
--    route /admin/* and toggle admin UI. A missing claim fails closed.
-- -----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_role text;
begin
  select coalesce(r.name, '')
    into v_role
  from public.users u
  left join public.roles r on r.id = u.role_id
  where u.id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(v_role = 'Admin'));
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- -----------------------------------------------------------------------------
-- 2. handle_new_user — auto-creates a public.users row for every new
--    auth.users row (covers accounts created outside the app, e.g. via the
--    Supabase Dashboard or scripts/createUser.cjs). Uses the first active
--    organization and the 'Business Developer' role (the lowest-privilege
--    default; matches the backfill default chosen when users.role_id was
--    made NOT NULL). Bails out (returns new without inserting) rather than
--    raising when reference data is missing, so account creation never
--    fails even on a fresh/unseeded project — this is the final, fixed
--    version (20260820090000_fix_handle_new_user_role.sql corrected the
--    original's now-renamed 'User' role lookup, which had started aborting
--    every auth signup once role_id became NOT NULL).
-- -----------------------------------------------------------------------------
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. sync_user_email — keeps public.users.email from drifting when a user's
--    auth email changes (e.g. via the Supabase Dashboard, or any future
--    admin-driven email change flow). public.users.email is not writable
--    directly for this reason; this trigger is the only path that updates it
--    in response to an auth-side change.
-- -----------------------------------------------------------------------------
create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_user_email();

-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------

-- anon: no access to any public-schema table or the application_status /
-- job_engagement_type enum types. Keep default privileges from re-granting
-- anon access on any table created in the future by the migration role.
revoke all privileges on all tables in schema public from anon;
revoke usage on type public.application_status from anon;
revoke usage on type public.job_engagement_type from anon;
alter default privileges in schema public revoke all on tables from anon;

-- service_role: full, unrestricted access (cron / admin path).
grant all privileges on all tables in schema public to service_role;

-- authenticated: table grants matching the verbs the backend's Route
-- Handlers issue via the authenticated client for each table.
grant select on public.organizations to authenticated;
grant select on public.roles, public.pipeline_stages, public.seniority_level, public.scrapers to authenticated;
grant insert, update, delete on public.pipeline_stages to authenticated;

grant select, insert, update, delete on public.users to authenticated;
grant select, insert on public.jobs to authenticated;
grant update on public.jobs to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profile_cvs to authenticated;
grant select on public.job_profile_matches to authenticated;
grant select, insert, update on public.job_profile_states to authenticated;
-- No delete: leads have no delete route (app/api/leads/*) — only soft-delete
-- via deleted_at, which update already covers.
grant select, insert, update on public.leads to authenticated;
grant select, insert, update, delete on public.job_comments to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert on public.user_activities to authenticated;
