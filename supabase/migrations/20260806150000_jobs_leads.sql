create table public.jobs (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id),
  scraper_id            uuid not null references public.scrapers(id),
  external_job_id       text not null,
  title                 text not null,
  company_name          text not null,
  company_location      text,
  description           text,
  apply_url             text not null,
  is_remote             boolean,
  remote_allowed_region text,
  job_posted_at         timestamptz,
  created_at            timestamptz not null default now(),
  is_globally_open      boolean,
  possibly_closed       boolean not null default false,
  possibly_closed_reason text,
  constraint jobs_scraper_external_key unique (scraper_id, external_job_id)
);

create table public.leads (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id),
  job_id               uuid not null references public.jobs(id),
  profile_id           uuid not null references public.profiles(id),
  job_profile_state_id uuid,
  user_id              uuid not null references public.users(id),
  pipeline_stage_id    uuid not null references public.pipeline_stages(id),
  applied_at           timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  -- Applier's Notes: written only by the user whose assigned profile was
  -- used to apply (enforced in the API + app; RLS scopes updates to the
  -- owner snapshot user_id).
  notes                text not null default ''
);

create trigger update_leads_updated_at
  before update on public.leads
  for each row execute function public.update_updated_at_column();

create index idx_jobs_organization_id on public.jobs(organization_id);
create index idx_jobs_scraper_id on public.jobs(scraper_id);
create index idx_leads_organization_id on public.leads(organization_id);
create index idx_leads_job_id on public.leads(job_id);
create index idx_leads_profile_id on public.leads(profile_id);
create index idx_leads_user_id on public.leads(user_id);
create index idx_leads_pipeline_stage_id on public.leads(pipeline_stage_id);
create index idx_leads_applied_at on public.leads(applied_at);

alter table public.jobs   enable row level security;
alter table public.leads  enable row level security;
