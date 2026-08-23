alter table public.pipeline_stages
  add column state text not null default 'active'
    check (state in ('active', 'paused', 'closed'));

alter table public.pipeline_stages
  add column updated_at timestamptz not null default now();

create trigger update_pipeline_stages_updated_at
  before update on public.pipeline_stages
  for each row execute function public.update_updated_at_column();

alter table public.pipeline_stages enable row level security;

grant insert, update, delete on public.pipeline_stages to authenticated;

create policy pipeline_stages_select on public.pipeline_stages
  for select to authenticated using (true);

create policy pipeline_stages_insert on public.pipeline_stages
  for insert to authenticated with check (is_admin());

create policy pipeline_stages_update on public.pipeline_stages
  for update to authenticated using (is_admin());

create policy pipeline_stages_delete on public.pipeline_stages
  for delete to authenticated using (is_admin());
