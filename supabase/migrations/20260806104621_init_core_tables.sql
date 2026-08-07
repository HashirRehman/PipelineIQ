create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  order_index integer not null,
  created_at  timestamptz not null default now()
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role_id         uuid references public.roles(id) on delete set null,
  full_name       text not null,
  email           text not null unique,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.seniority_level (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at_column();

create trigger update_users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at_column();

create index idx_users_organization_id on public.users(organization_id);
create index idx_users_role_id on public.users(role_id);

alter table public.organizations   enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.users           enable row level security;
alter table public.roles           enable row level security;
alter table public.seniority_level enable row level security;
