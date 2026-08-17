-- How a job reached us: inbound (the client approached us) or outbound (we
-- found the posting and applied). Optional — null means unclassified, which
-- is what every existing row and every scraped job stays until someone sets
-- it. Additive: no backfill, no reset.
--
-- An enum rather than free text because it's a closed two-value set the UI
-- drives, unlike jobs.remote_allowed_region (deliberately free text because
-- its data isn't clean). A real column rather than jobs.parsed_data — where
-- the manual-job extras source/budget/developer live — because this one is
-- filtered on and needs an index, and parsed_data is the AI-parse bucket.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

create type public.job_engagement_type as enum ('inbound', 'outbound');

alter table public.jobs
  add column if not exists engagement_type public.job_engagement_type;

comment on column public.jobs.engagement_type is
  'How the job reached us: inbound = client approached us, outbound = we applied. Null = unclassified (all scraped jobs, and manual jobs where the user left it blank).';

-- Filter support on the Pipeline and Leads pages. Partial: null rows are the
-- majority and are never filtered for.
create index idx_jobs_engagement_type
  on public.jobs (organization_id, engagement_type)
  where engagement_type is not null;
