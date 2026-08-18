-- Job editing: the missing table privilege.
--
-- Migration 20260812130222 added the jobs_update RLS policy (and
-- manual_overrides), but never widened the grant. RLS filters WHICH rows a
-- role may touch; it cannot grant the verb itself, so every edit failed with
-- 42501 "permission denied for table jobs" before the policy was consulted.
--
-- migration 20260812110000 set the convention this restores: "grants match
-- the verbs the app actually issues through the user client" — the app now
-- issues UPDATE (PATCH /api/jobs/[jobId]), so the grant has to say so. RLS
-- remains the row boundary: jobs_update is still is_admin() or
-- is_bd_manager(), so a Business Developer with this grant still updates
-- zero rows.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

grant update on public.jobs to authenticated;