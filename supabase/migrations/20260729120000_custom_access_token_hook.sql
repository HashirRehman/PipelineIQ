-- Custom Access Token Hook — bakes is_admin into every issued/refreshed
-- JWT so the app layer (middleware.ts, lib/supabase/server.ts) can read
-- role status via a local JWT decode (supabase.auth.getClaims()) instead
-- of a live supabase.rpc("is_admin") round trip on every navigation.
--
-- This is an app-layer speed optimization ONLY. Every RLS policy in this
-- database still calls public.is_admin() directly, live, at query time —
-- that function is untouched and remains the real access-control
-- boundary. Postgres never trusts this JWT claim.
--
-- Real trade-off: a role change only reaches an already-issued session's
-- claims on that session's next token refresh (up to auth.jwt_expiry
-- later), not instantly like a live is_admin() check. If a role change
-- ever needs to take effect immediately for someone already logged in,
-- force-expire their session (supabase.auth.admin.signOut(userId)).
--
-- Must be enabled in two places to take effect, neither of which this
-- migration does on its own:
--   1. Local dev: supabase/config.toml's [auth.hook.custom_access_token]
--   2. Production: Supabase Dashboard > Authentication > Hooks > Custom
--      Access Token > select this function (dashboard-only, no CLI/SQL
--      equivalent — must be done manually).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims jsonb;
  is_admin_result boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (event->>'user_id')::uuid
      and r.name = 'admin'
  ) into is_admin_result;

  claims := event->'claims';
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(is_admin_result));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Auth Hook (Custom Access Token) — adds is_admin to the JWT at mint/refresh time. App-layer convenience only; RLS policies still call is_admin() live, never trust this claim.';

-- Supabase's Auth service invokes hooks as supabase_auth_admin, not the
-- calling user's own role — this grant is what makes the hook callable
-- at all. Explicitly revoked from every other role since this function's
-- only legitimate caller is the Auth service itself.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
