-- Editing scraped jobs.
--
-- migration 18 added jobs_insert (anyone in the org may add a job), but there
-- is still no update policy, so an authenticated edit is denied — silently, as
-- zero rows rather than an error. Editing is Admin + BD Manager, matching
-- profile management; Business Developers keep the job pages read-only even
-- though they may create a job. The cron is unaffected either way: it runs
-- with the service-role client, which bypasses RLS.
--
-- manual_overrides lists the column names a user has changed. The nightly
-- discovery cron upserts on (scraper_id, external_job_id) and rewrites title,
-- company_name, company_location, description, apply_url, is_remote and
-- job_posted_at every run, so without this the next run would revert any edit.
-- The cron reads this array and drops those columns from its payload, which
-- keeps the columns authoritative: no read path merges anything, and relevance
-- scoring sees the corrected text. Clearing an entry hands the column back to
-- the source. Manually created jobs don't need it — their external_job_id is a
-- uuid no scraper can produce, so ingestion never matches them.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

alter table public.jobs
  add column manual_overrides text[] not null default '{}';

comment on column public.jobs.manual_overrides is
  'Column names edited by a user; the discovery cron will not overwrite these.';

-- Only ingest-written columns are protectable, so a typo like 'titel' fails
-- here instead of silently protecting nothing.
alter table public.jobs
  add constraint jobs_manual_overrides_known_columns
  check (
    manual_overrides <@ array[
      'title',
      'company_name',
      'company_location',
      'description',
      'apply_url',
      'is_remote',
      'job_posted_at'
    ]::text[]
  );

create policy jobs_update on public.jobs
  for update to authenticated
  using (is_admin() or is_bd_manager())
  with check (is_admin() or is_bd_manager());
