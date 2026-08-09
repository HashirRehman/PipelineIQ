-- Discovery SQL support: the dismissed_reason column the dismiss UX needs.
-- State rows are lazy — they are created by the mark-applied / dismiss routes
-- on first user action, not here. Match scores are persisted straight from
-- lib/cron/discover-jobs.ts (service-role upsert on job_profile_matches) —
-- no SQL function involved.

alter table public.job_profile_states
  add column dismissed_reason text;
