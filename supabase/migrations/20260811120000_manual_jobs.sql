-- Manual job creation (the "New Job" flow on the Pipeline page) -----------
-- 1. A "Manual" scraper row so hand-added jobs satisfy jobs.scraper_id
--    NOT NULL without inventing an external source. The real source text the
--    user types is stored on jobs.parsed_data (source), surfaced by the API.
--    Idempotent: only inserted when no 'Manual' scraper exists yet.
-- 2. jobs_insert RLS policy — jobs previously had a select-only policy, so
--    app writes were impossible. Anyone in the org may add a job; the check
--    pins organization_id to the caller's own org (users.organization_id is
--    NOT NULL for every real account).
insert into public.scrapers (id, name, base_url)
select '10000000-0000-4000-8000-000000000031', 'Manual', ''
where not exists (
  select 1 from public.scrapers where name = 'Manual'
);

create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (
    organization_id = (
      select organization_id
      from public.users
      where id = auth.uid() and deleted_at is null
    )
  );
