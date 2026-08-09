-- job_comments — team discussion on jobs.
--
-- Comments are flat (no replies), tied to a user and a job. organization_id
-- is the job's org (same as the commenter's org — only same-org users see
-- the job in the app). Rows are soft-deleted (deleted_at) so history
-- survives; the app hides deleted rows. Any authenticated user of the org
-- can comment; edits are author-only, deletes are author-or-admin.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`
-- (supabase db push). PostgREST grants are included explicitly because the
-- seed's blanket grant only covered tables that existed when it ran.

create table public.job_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint job_comments_body_length check (char_length(btrim(body)) between 1 and 2000)
);

create trigger update_job_comments_updated_at
  before update on public.job_comments
  for each row execute function public.update_updated_at_column();

create index idx_job_comments_job_id on public.job_comments(job_id);
create index idx_job_comments_organization_id on public.job_comments(organization_id);
create index idx_job_comments_user_id on public.job_comments(user_id);

grant select, insert, update on public.job_comments to authenticated;
grant select, insert, update, delete on public.job_comments to service_role;

alter table public.job_comments enable row level security;

-- Readers: users of the job's org (the commenter's org) + admins.
create policy job_comments_select on public.job_comments
  for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.organization_id = job_comments.organization_id
    )
  );

-- Writers: any authenticated user of the same org, on jobs of the same org.
create policy job_comments_insert on public.job_comments
  for insert to authenticated
  with check (
    is_admin()
    or (
      exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.organization_id = job_comments.organization_id
      )
      and exists (
        select 1 from public.jobs j
        where j.id = job_id and j.organization_id = job_comments.organization_id
      )
    )
  );

-- Edits + soft deletes: the author, or an admin (moderation).
create policy job_comments_update on public.job_comments
  for update to authenticated
  using (is_admin() or user_id = auth.uid())
  with check (is_admin() or user_id = auth.uid());
