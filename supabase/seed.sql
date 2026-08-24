-- ============================================================
-- RevX — seed data (reference data only, no dummy records)
-- Idempotent: safe to re-run (ON CONFLICT ... DO NOTHING, matched by the
-- natural key — name/email — not by a hardcoded id; every id here is
-- generated fresh by gen_random_uuid() on first insert).
-- Applied automatically by `supabase db reset` (config.toml [db.seed]).
-- For a remote fresh project: `supabase db reset --linked`, or run this
-- file against the database directly.
-- The Admin auth user is created separately: scripts/createUser.cjs
-- (npm run seed:user) — SQL seed files cannot create auth.users rows.
-- ============================================================

-- Organizations ---------------------------------------------------
-- allowed_email_domain gates who may be invited into the org.
insert into public.organizations (name, is_active, allowed_email_domain)
select 'Recurso Labs', true, 'recursolabs.com'
where not exists (
  select 1 from public.organizations where name = 'Recurso Labs'
);

-- Roles -------------------------------------------------------------
-- Must match lib/auth/roles.ts (ROLE_PERMISSIONS) exactly — the app looks
-- roles up BY NAME, so a rename here silently changes permissions.
-- public.handle_new_user() looks up 'Business Developer' by name for the
-- default role on signup — keep that row's name in sync if it's ever renamed.
insert into public.roles (name, description)
select v.name, v.description
from (values
  ('Admin',              'Full platform access'),
  ('BD Manager',         null),
  ('Business Developer', 'Standard user access')
) as v(name, description)
where not exists (select 1 from public.roles r where r.name = v.name);

-- Seniority levels ----------------------------------------------------
insert into public.seniority_level (name)
select v.name
from (values ('Lead'), ('Senior'), ('Mid'), ('Junior')) as v(name)
where not exists (select 1 from public.seniority_level s where s.name = v.name);

-- Pipeline stages (lead pipeline after an employer reply) --------------
-- The frontend reads these dynamically (status select, board columns, list
-- sections, filters); order_index drives the UI order and the stage colors.
insert into public.pipeline_stages (name, order_index, state)
select v.name, v.order_index, v.state
from (values
  ('First Round',   1, 'active'),
  ('Second Round',  2, 'active'),
  ('Third Round',   3, 'active'),
  ('Final Stages',  4, 'active'),
  ('Rejected',      5, 'active'),
  ('Accepted',      6, 'closed'),
  ('On Hold',       7, 'paused'),
  ('No Response',   8, 'paused'),
  ('Miscellaneous', 9, 'active')
) as v(name, order_index, state)
where not exists (select 1 from public.pipeline_stages p where p.name = v.name);
