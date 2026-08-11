-- Add parsed_data JSONB column to jobs table
-- IF NOT EXISTS: the column already exists on the dev database (it was added
-- manually during feature development, before this migration was pushed), so
-- the migration must be safe to run against both an existing and a fresh DB.
alter table public.jobs add column if not exists parsed_data jsonb;
