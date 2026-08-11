-- Add parsed_data JSONB column to jobs table
alter table public.jobs add column parsed_data jsonb;
