create type public.application_status as enum ('suggested', 'dismissed', 'applied');

create table public.job_profile_matches (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  job_id           uuid not null references public.jobs(id),
  profile_id       uuid not null references public.profiles(id),
  cv_id            uuid not null references public.profile_cvs(id),
  relevance_score  numeric(5,2) not null check (relevance_score >= 0 and relevance_score <= 100),
  ai_model_version text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint job_profile_matches_job_profile_cv_key unique (job_id, profile_id, cv_id)
);

create table public.job_profile_states (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  job_id           uuid not null references public.jobs(id),
  profile_id       uuid not null references public.profiles(id),
  status           public.application_status not null default 'suggested',
  user_id          uuid references public.users(id),
  cv_id            uuid references public.profile_cvs(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index job_profile_states_one_live_per_pair
  on public.job_profile_states (job_id, profile_id)
  where deleted_at is null;

alter table public.leads
  add constraint leads_job_profile_state_id_fkey
  foreign key (job_profile_state_id) references public.job_profile_states(id);

create trigger update_job_profile_matches_updated_at
  before update on public.job_profile_matches
  for each row execute function public.update_updated_at_column();

create trigger update_job_profile_states_updated_at
  before update on public.job_profile_states
  for each row execute function public.update_updated_at_column();

create index idx_job_profile_matches_job_id on public.job_profile_matches(job_id);
create index idx_job_profile_matches_profile_id on public.job_profile_matches(profile_id);
create index idx_job_profile_matches_cv_id on public.job_profile_matches(cv_id);
create index idx_job_profile_states_job_id on public.job_profile_states(job_id);
create index idx_job_profile_states_profile_id on public.job_profile_states(profile_id);
create index idx_job_profile_states_user_id on public.job_profile_states(user_id);
create index idx_job_profile_states_cv_id on public.job_profile_states(cv_id);
create index idx_job_profile_states_status on public.job_profile_states(status);
create index idx_leads_job_profile_state_id on public.leads(job_profile_state_id);

alter table public.job_profile_matches enable row level security;
alter table public.job_profile_states  enable row level security;
