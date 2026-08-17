-- user_activities — the org's activity feed (who did what, when).
--
-- Records BUSINESS actions: profiles created/edited/assigned, CVs uploaded,
-- jobs added/imported, leads created/advanced, comments posted, discovery
-- runs. Written best-effort by lib/api/activity.ts after the mutation it
-- describes has already SUCCEEDED, so the feed never shows an action that
-- didn't happen.
--
-- Deliberately SEPARATE from audit_logs (20260812010000). That table is the
-- security/team-management trail (login, password_set, invite_sent,
-- user_updated, user_deleted) and its reads are Admin-only on purpose. This
-- one is the product's activity feed with a wider audience. Keeping them
-- apart means widening the feed's visibility never widens access to the
-- security trail.
--
-- APPEND-ONLY, and that is enforced three ways because RLS alone cannot do
-- it (service_role bypasses RLS entirely, and TRUNCATE ignores RLS even for
-- the authenticated role):
--   1. No UPDATE / DELETE policies for authenticated.
--   2. Grants: only SELECT + INSERT to authenticated (all other verbs,
--      including the TRUNCATE that default privileges hand out, revoked).
--   3. Triggers that raise on UPDATE / DELETE / TRUNCATE. Triggers fire
--      regardless of role or RLS, so not even the service key can rewrite
--      history. This is the actual guarantee; 1 and 2 are defense in depth.
--
-- CONVENTION DIVERGENCE (deliberate): the schema doc mandates deleted_at on
-- every mutable table and updated_at where rows change. This table has
-- neither — a row is written once and never touched again, so there is
-- nothing to soft-delete or update. Recording a "deleted" activity would
-- also directly contradict the append-only requirement.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.user_activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  -- The actor. ON DELETE SET NULL matches leads.user_id / audit_logs
  -- (migration 13): deleting a team member must not delete history.
  user_id         uuid references public.users(id) on delete set null,
  -- Snapshot of the actor's display name, so a deleted user's activity still
  -- renders as a person instead of "Unknown". user_id stays the column that
  -- scoping and filtering use.
  actor_name      text not null,
  -- Machine-readable verb, e.g. 'profile_created'. Free text rather than an
  -- enum (a new action would otherwise need a migration) — the TypeScript
  -- ActivityAction union in lib/api/activity.ts is the source of truth. The
  -- CHECK below only pins the SHAPE, to stop the vocabulary drifting into
  -- "Profile Updated" / "updateProfile" variants of the same action.
  action          text not null,
  -- What the action was about. Polymorphic on purpose: this table points at
  -- profiles, jobs, leads, CVs and comments, and a nullable FK per entity
  -- type would add a column for every future entity. No FK, so the row
  -- survives its subject being deleted — which is the point of a log.
  entity_type     text,
  entity_id       uuid,
  -- Snapshot of the subject's name at the time (profile name, job title).
  -- Deriving it at read time would break or silently change once the entity
  -- is renamed or removed; a snapshot stays true to what happened.
  entity_label    text,
  -- Rendered, human-readable sentence for the feed, e.g.
  -- 'Uploaded CV "jane-doe.pdf" to profile "Jane Doe"'. Also a snapshot, for
  -- the same reason as entity_label.
  description     text not null,
  -- Structured extras (old/new values, counts) for detail views. Not used
  -- for display text.
  metadata        jsonb not null default '{}'::jsonb,
  ip_address      text,
  created_at      timestamptz not null default now(),

  constraint user_activities_action_format
    check (action ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint user_activities_description_length
    check (char_length(btrim(description)) between 1 and 500),
  constraint user_activities_actor_name_length
    check (char_length(btrim(actor_name)) between 1 and 200),
  constraint user_activities_entity_label_length
    check (entity_label is null or char_length(entity_label) <= 300),
  -- An id without a type is unreadable; a type without an id is fine
  -- (e.g. a bulk import that has no single subject).
  constraint user_activities_entity_type_present
    check (entity_id is null or entity_type is not null)
);

-- ---------------------------------------------------------------------------
-- Indexes — the feed is always "newest first", optionally narrowed.
-- ---------------------------------------------------------------------------
create index idx_user_activities_org_created
  on public.user_activities (organization_id, created_at desc);
-- Covers a Business Developer's own-activity feed (the common case for that
-- role) without scanning the whole org.
create index idx_user_activities_user_created
  on public.user_activities (user_id, created_at desc);
create index idx_user_activities_action
  on public.user_activities (action);
create index idx_user_activities_entity
  on public.user_activities (entity_type, entity_id)
  where entity_id is not null;

-- ---------------------------------------------------------------------------
-- Grants — exact verbs, no reliance on default privileges (the convention
-- 20260812120000_close_anon_grants.sql established). The blanket REVOKE also
-- strips TRUNCATE, which default privileges grant and which would otherwise
-- let the authenticated role empty the table without RLS ever applying.
-- ---------------------------------------------------------------------------
revoke all privileges on public.user_activities from anon;
revoke all privileges on public.user_activities from authenticated;
grant select, insert on public.user_activities to authenticated;
-- service_role keeps full grants (cron / admin path) but the triggers below
-- still block it from rewriting history.
grant select, insert on public.user_activities to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.user_activities enable row level security;

-- Writers: a member may record only their OWN activity, only in their OWN
-- org. Binding user_id to auth.uid() means one user can never forge an entry
-- attributed to somebody else.
create policy user_activities_insert on public.user_activities
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- Readers: Admin and BD Manager see the whole org's feed (is_privileged_in
-- is the existing "Admin or BD Manager OF THIS org" helper from
-- 20260812100000); every other role sees only their own rows.
create policy user_activities_select on public.user_activities
  for select to authenticated
  using (
    public.is_privileged_in(organization_id)
    or (
      organization_id = public.current_org_id()
      and user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies: append-only.

-- ---------------------------------------------------------------------------
-- Immutability — the real guarantee.
--
-- RLS is not enough here: service_role bypasses it, and TRUNCATE is never
-- subject to it. A trigger fires for every role and every path (including
-- the service key and direct SQL), so history cannot be rewritten short of
-- the table owner explicitly disabling the trigger.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_user_activity_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception
    'public.user_activities is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;

grant execute on function public.prevent_user_activity_mutation()
  to authenticated, service_role;

-- Row-level: blocks UPDATE and DELETE.
drop trigger if exists user_activities_no_update_delete on public.user_activities;
create trigger user_activities_no_update_delete
  before update or delete on public.user_activities
  for each row execute function public.prevent_user_activity_mutation();

-- Statement-level: TRUNCATE never fires row triggers, so it needs its own.
drop trigger if exists user_activities_no_truncate on public.user_activities;
create trigger user_activities_no_truncate
  before truncate on public.user_activities
  for each statement execute function public.prevent_user_activity_mutation();
