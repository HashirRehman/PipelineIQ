create table public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id),
  user_id             uuid unique references public.users(id),
  full_name           text not null,
  email               text not null unique,
  phone               text,
  location            text,
  seniority_level_id  uuid references public.seniority_level(id),
  years_of_experience numeric(4,1) check (years_of_experience >= 0),
  rate_expectation    numeric(10,2) check (rate_expectation >= 0),
  rate_currency       char(3) not null default 'USD',
  rate_unit           text,
  summary             text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create table public.profile_cvs (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  file_type       text not null,
  file_size_bytes bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.scrapers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  base_url   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.cron_run_locks (
  id                uuid primary key default gen_random_uuid(),
  is_running        boolean not null default false,
  started_at        timestamptz,
  last_completed_at timestamptz,
  updated_at        timestamptz not null default now()
);

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_profile_cvs_updated_at
  before update on public.profile_cvs
  for each row execute function public.update_updated_at_column();

create trigger update_scrapers_updated_at
  before update on public.scrapers
  for each row execute function public.update_updated_at_column();

create trigger update_cron_run_locks_updated_at
  before update on public.cron_run_locks
  for each row execute function public.update_updated_at_column();

create index idx_profiles_organization_id on public.profiles(organization_id);
create index idx_profiles_seniority_level_id on public.profiles(seniority_level_id);
create index idx_profiles_is_active on public.profiles(is_active);
create index idx_profile_cvs_profile_id on public.profile_cvs(profile_id);

alter table public.profiles        enable row level security;
alter table public.profile_cvs     enable row level security;
alter table public.scrapers        enable row level security;
alter table public.cron_run_locks  enable row level security;
