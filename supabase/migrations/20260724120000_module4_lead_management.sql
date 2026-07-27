-- ============================================================================
-- Module 4 — Lead Management: pipeline_stages, leads, lead_event_types,
-- lead_events, create_lead_from_match(), withdraw_lead().
--
-- pipeline_stages is created here as a hard structural dependency, not
-- Module 5 scope creep — leads.current_stage_id is a NOT NULL FK to it
-- (doc 02 §16), so leads cannot exist without it. Only the
-- stage-reordering UI/Server Actions are deferred to Module 5/6; the
-- table and its MVP seed data are Part A/MVP schema per doc 02 §15.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: pipeline_stages (lookup, dependency only)
-- ----------------------------------------------------------------------------
create table public.pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  order_index  smallint not null unique,
  is_terminal  boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.pipeline_stages is
  'Configurable ordered stage list — explicitly required to not be hardcoded (doc 02 §15). Reordering UI is Module 5/6 scope; this migration only creates and seeds it because leads.current_stage_id requires it to exist.';

insert into public.pipeline_stages (name, order_index, is_terminal) values
  ('Applied', 1, false),
  ('Assessment Received', 2, false),
  ('Assessment Submitted', 3, false),
  ('HR Interview', 4, false),
  ('Tech Interview 1', 5, false),
  ('Tech Interview 2', 6, false),
  ('Client Interview', 7, false),
  ('Offer Received', 8, false),
  ('Offer Accepted/Rejected', 9, true),
  ('Closed', 10, true);

alter table public.pipeline_stages enable row level security;

create policy pipeline_stages_select on public.pipeline_stages
  for select
  to authenticated
  using (true);

create policy pipeline_stages_insert on public.pipeline_stages
  for insert
  to authenticated
  with check (public.is_admin());

create policy pipeline_stages_update on public.pipeline_stages
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.pipeline_stages to authenticated;

-- ----------------------------------------------------------------------------
-- Table: lead_event_types (lookup)
-- ----------------------------------------------------------------------------
create table public.lead_event_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  created_at  timestamptz not null default now()
);

comment on table public.lead_event_types is
  'Lookup, not an enum, so future modules add event kinds via INSERT, not a migration (doc 02 §17). Only the two codes Module 4''s own functions need are seeded now — stage_changed and withdrawn.';

insert into public.lead_event_types (code, label) values
  ('stage_changed', 'Stage changed'),
  ('withdrawn', 'Lead withdrawn');

alter table public.lead_event_types enable row level security;

create policy lead_event_types_select on public.lead_event_types
  for select
  to authenticated
  using (true);

create policy lead_event_types_insert on public.lead_event_types
  for insert
  to authenticated
  with check (public.is_admin());

create policy lead_event_types_update on public.lead_event_types
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.lead_event_types to authenticated;

-- ----------------------------------------------------------------------------
-- Enum: lead_status
-- ----------------------------------------------------------------------------
create type public.lead_status as enum ('active', 'withdrawn', 'closed');

-- ----------------------------------------------------------------------------
-- Table: leads
-- ----------------------------------------------------------------------------
create table public.leads (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid not null references public.jobs (id),
  engineer_id            uuid not null references public.engineers (id),
  job_engineer_match_id  uuid not null references public.job_engineer_matches (id),
  bd_user_id             uuid not null references public.profiles (id),
  current_stage_id       uuid not null references public.pipeline_stages (id),
  status                 public.lead_status not null default 'active',
  applied_at             timestamptz not null default now(),
  last_activity_at       timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.leads is
  'The core application record. bd_user_id is a permanent ownership snapshot taken at creation by create_lead_from_match() — never derived from or updated by engineer_bd_assignments, so a lead stays visible to its original BD after the engineer is reassigned (doc 01 §1). Created only via create_lead_from_match() — no INSERT policy exists for authenticated; see that function''s SECURITY DEFINER note below.';

-- Duplicate-prevention rule (doc 01 §16): at most one active-or-closed
-- lead per (job, engineer) at a time. A withdrawn lead drops out of this
-- partial index, freeing the pairing for a new lead; closed never does —
-- reapplication is blocked permanently after rejection/closure, allowed
-- again only after withdrawal.
create unique index leads_no_duplicate_active_or_closed
  on public.leads (job_id, engineer_id)
  where status <> 'withdrawn';

create index idx_leads_bd_user_id_status on public.leads (bd_user_id, status);
create index idx_leads_current_stage_id on public.leads (current_stage_id);
create index idx_leads_last_activity_at on public.leads (last_activity_at);

create trigger set_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

alter table public.leads enable row level security;

-- bd_user_id compared directly to auth.uid() — no join through
-- engineer_bd_assignments/assigned_engineer_ids(). This is the permanent
-- snapshot, not current assignment, per doc 01 §1.
create policy leads_select on public.leads
  for select
  to authenticated
  using (public.is_admin() or bd_user_id = auth.uid());

create policy leads_update on public.leads
  for update
  to authenticated
  using (public.is_admin() or bd_user_id = auth.uid())
  with check (public.is_admin() or bd_user_id = auth.uid());

-- Deliberately no INSERT policy — see create_lead_from_match()'s comment.
grant select, update on public.leads to authenticated;

-- ----------------------------------------------------------------------------
-- Table: lead_events (append-only)
-- ----------------------------------------------------------------------------
create table public.lead_events (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.leads (id),
  event_type_id  uuid not null references public.lead_event_types (id),
  stage_id       uuid references public.pipeline_stages (id),
  note           text,
  ai_summary     text,
  occurred_at    timestamptz not null default now(),
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now()
);

comment on table public.lead_events is
  'Append-only audit trail / timeline per lead (doc 02 §18). RLS grants INSERT and SELECT only — no UPDATE/DELETE to any non-service role, ever, same shape as login_history.';

create index idx_lead_events_lead_id_occurred_at on public.lead_events (lead_id, occurred_at);

alter table public.lead_events enable row level security;

create policy lead_events_select on public.lead_events
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.leads l where l.id = lead_events.lead_id and l.bd_user_id = auth.uid())
  );

create policy lead_events_insert on public.lead_events
  for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.leads l where l.id = lead_events.lead_id and l.bd_user_id = auth.uid())
  );

grant select, insert on public.lead_events to authenticated;

-- leads.last_activity_at is maintained by trigger from lead_events (doc 02
-- §16), not application code, so stale-lead detection stays a plain
-- indexed query regardless of which code path inserted the event.
create or replace function public.touch_lead_last_activity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.leads set last_activity_at = new.occurred_at where id = new.lead_id;
  return new;
end;
$$;

create trigger set_lead_last_activity
after insert on public.lead_events
for each row
execute function public.touch_lead_last_activity();

-- ----------------------------------------------------------------------------
-- Function: create_lead_from_match()
--
-- SECURITY DEFINER, unlike reassign_engineer_bd's default INVOKER — this
-- is what makes "never a bare INSERT" (doc 02 §16) a real, DB-enforced
-- guarantee rather than an application-code convention: leads has no
-- INSERT policy for authenticated at all, so this function's own
-- explicit is_admin()/p_bd_user_id authorization check, run here under
-- elevated privilege, is the only path that can ever create a row.
--
-- Duplicate check + leads insert + job_engineer_matches flip + lead_events
-- insert are one plpgsql function body — Postgres runs it as a single
-- transaction, so any raised exception rolls back everything before it.
-- ----------------------------------------------------------------------------
create or replace function public.create_lead_from_match(
  p_match_id    uuid,
  p_bd_user_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id              uuid;
  v_engineer_id         uuid;
  v_match_status        public.match_status;
  v_lead_id             uuid;
  v_applied_stage_id    uuid;
  v_stage_changed_type  uuid;
begin
  if not (public.is_admin() or p_bd_user_id = auth.uid()) then
    raise exception 'Not authorized to create a lead for this BD.';
  end if;

  select job_id, engineer_id, status into v_job_id, v_engineer_id, v_match_status
  from public.job_engineer_matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found.';
  end if;

  if not (public.is_admin() or v_engineer_id in (select public.assigned_engineer_ids())) then
    raise exception 'Not authorized to act on this match.';
  end if;

  if v_match_status = 'dismissed' then
    raise exception 'This match was dismissed and cannot be converted to a lead.';
  end if;

  if exists (
    select 1 from public.leads
    where job_id = v_job_id and engineer_id = v_engineer_id and status <> 'withdrawn'
  ) then
    raise exception 'An active or closed lead already exists for this engineer and job.';
  end if;

  select id into v_applied_stage_id from public.pipeline_stages where name = 'Applied';
  select id into v_stage_changed_type from public.lead_event_types where code = 'stage_changed';

  insert into public.leads (job_id, engineer_id, job_engineer_match_id, bd_user_id, current_stage_id)
  values (v_job_id, v_engineer_id, p_match_id, p_bd_user_id, v_applied_stage_id)
  returning id into v_lead_id;

  -- A match already flipped to 'applied' from a prior, now-withdrawn lead
  -- is legitimately reusable (doc 02 §14: "a match can be reused across
  -- multiple leads over time — e.g. withdraw -> reapply") — the real
  -- duplicate gate is the leads partial unique index above, not this
  -- column, so 'suggested' is deliberately not required here.
  update public.job_engineer_matches
  set status = 'applied'
  where id = p_match_id and status <> 'dismissed';

  insert into public.lead_events (lead_id, event_type_id, stage_id, created_by)
  values (v_lead_id, v_stage_changed_type, v_applied_stage_id, auth.uid());

  return v_lead_id;
end;
$$;

comment on function public.create_lead_from_match(uuid, uuid) is
  'Atomically creates a lead from an AI-suggested match: duplicate check, leads insert, job_engineer_matches status flip to applied, and the initial lead_events row all in one transaction — never a bare INSERT.';

revoke all on function public.create_lead_from_match(uuid, uuid) from public;
grant execute on function public.create_lead_from_match(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Function: withdraw_lead()
--
-- The "withdrawLead()-equivalent" — same atomicity principle as
-- create_lead_from_match(): status flip + audit event in one transaction,
-- never a bare UPDATE. Not named in doc 01's function list verbatim
-- (only create_lead_from_match/advance_lead_stage are) — this closes
-- that gap for Module 4's own scope.
-- ----------------------------------------------------------------------------
create or replace function public.withdraw_lead(
  p_lead_id  uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bd_user_id      uuid;
  v_status          public.lead_status;
  v_withdrawn_type  uuid;
begin
  select bd_user_id, status into v_bd_user_id, v_status
  from public.leads
  where id = p_lead_id;

  if not found then
    raise exception 'Lead not found.';
  end if;

  if not (public.is_admin() or v_bd_user_id = auth.uid()) then
    raise exception 'Not authorized to withdraw this lead.';
  end if;

  if v_status <> 'active' then
    raise exception 'Only an active lead can be withdrawn.';
  end if;

  update public.leads set status = 'withdrawn' where id = p_lead_id;

  select id into v_withdrawn_type from public.lead_event_types where code = 'withdrawn';

  insert into public.lead_events (lead_id, event_type_id, note, created_by)
  values (p_lead_id, v_withdrawn_type, p_reason, auth.uid());
end;
$$;

comment on function public.withdraw_lead(uuid, text) is
  'Atomically withdraws an active lead and records the withdrawal as a lead_events row — one transaction, guards against withdrawing an already-withdrawn or closed lead.';

revoke all on function public.withdraw_lead(uuid, text) from public;
grant execute on function public.withdraw_lead(uuid, text) to authenticated;
