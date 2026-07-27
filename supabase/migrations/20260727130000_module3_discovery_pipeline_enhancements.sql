-- Module 3 — discovery pipeline enhancements: combined eligibility
-- extraction fields on jobs, plus two Admin-tunable app_settings driving
-- the freshness cutoff and BD's relevance-score floor on /discovery.
alter table public.jobs
  add column is_globally_open boolean,
  add column possibly_closed boolean,
  add column possibly_closed_reason text;

comment on column public.jobs.is_globally_open is
  'Set by the enrichment step''s combined AiClient.extractRemoteRegion call. A real boolean the model sets directly — /discovery''s worldwide filter keys off this, not string-matching remote_region.';
comment on column public.jobs.possibly_closed is
  'Set by the same enrichment call — true only on explicit textual signals the posting is filled/closed, never inferred from age. Drives a visible badge, not a hard filter.';

insert into public.app_settings (key, value, description) values
  ('job_freshness_cutoff_days', '7'::jsonb,
   'Admin-tunable — jobs older than this (posted_at, falling back to discovered_at) are skipped entirely during scoring to save AI quota.'),
  ('discovery_min_relevance_score', '60'::jsonb,
   'Admin-tunable — BD Executives only see /discovery matches at or above this score; Admin''s view is never filtered by score.');
