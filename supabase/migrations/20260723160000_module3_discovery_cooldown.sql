-- Module 3 — global cooldown for the manual/eventual-cron discovery run.
--
-- Distinct from is_running/started_at (which stop two runs overlapping in
-- time): last_completed_at tracks when a run last genuinely finished, so
-- acquireDiscoveryLock() can also refuse a brand-new run for 15 minutes
-- after the previous one completed, regardless of who/what triggers it.
-- Only set on a real completion (see releaseDiscoveryLock's `completed`
-- flag) — never on a skipped or top-level-failed attempt.
alter table public.cron_run_locks add column last_completed_at timestamptz;
