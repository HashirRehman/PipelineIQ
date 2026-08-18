-- The Developer field is a LEAD attribute, not a job attribute.
--
-- One developer manages one lead, while a single job can have many leads —
-- one per profile that applied (different people apply to the same posting,
-- so the job itself must not carry a single developer). It previously lived
-- on jobs.parsed_data ->> 'developer' (written by the manual-job and import
-- flows), which every lead of the same job shared. This migration moves it
-- onto the lead, backfilling existing rows from the job's parsed_data.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

alter table public.leads
  add column developer text;

comment on column public.leads.developer is
  'The developer handling this lead. Lead-specific: a job may have many leads (one per applying profile).';

-- Backfill existing leads from the legacy location (jobs.parsed_data).
-- Rows whose job never carried a developer stay null.
update public.leads l
set developer = j.parsed_data ->> 'developer'
from public.jobs j
where j.id = l.job_id
  and l.developer is null
  and j.parsed_data ->> 'developer' is not null
  and j.parsed_data ->> 'developer' <> '';
