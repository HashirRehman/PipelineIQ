-- Security audit log (accountability for team-management events).
--
-- Records who did what: successful logins, password sets, invites, member
-- status/role changes, and member deletion. The app writes these best-effort
-- via lib/api/audit.ts — an audit failure never blocks the operation it
-- records.
--
-- RLS model:
--   * INSERT — any member of the org can record an event scoped to their own
--     organization (actors are org members by construction; the check binds
--     the row's organization_id to the caller's users row).
--   * SELECT — admin-only (a team roster tool shouldn't hand every member
--     the full activity trail; admins already see everything).
--   * No UPDATE / DELETE policies — rows are append-only through RLS.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`
-- (which also regenerates lib/supabase/database.types.ts, so `audit_logs`
-- becomes typed for the insert helper).

create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_user_id   uuid references public.users(id) on delete set null,
  action          text not null,
  target_user_id  uuid references public.users(id) on delete set null,
  target_email    text,
  ip_address      text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index idx_audit_logs_org_created on public.audit_logs (organization_id, created_at desc);
create index idx_audit_logs_action on public.audit_logs (action);

alter table public.audit_logs enable row level security;

create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.organization_id = audit_logs.organization_id
        and u.deleted_at is null
    )
  );

create policy audit_logs_select on public.audit_logs
  for select to authenticated using (is_admin());
