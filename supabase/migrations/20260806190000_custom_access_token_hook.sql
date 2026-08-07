-- custom_access_token_hook — injects is_admin / user_role claims into JWTs.
-- Recreated after the fresh-schema reset: the old migration was deleted with
-- the old history, but config.toml enables this hook and middleware.ts +
-- getCachedIsAdmin() read the is_admin claim to route /admin/* and toggle
-- admin UI. A missing claim fails closed (no is_admin => not admin).

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
