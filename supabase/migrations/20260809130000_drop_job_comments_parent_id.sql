-- Follow-up to 20260809120000_job_comments.sql — comments are flat, no
-- replies, so parent_id and its index are removed. The original migration
-- was already applied to the remote with parent_id, so this drop ships as
-- its own additive migration (`npm run migrate:up`, no reset). The table
-- went live only minutes before this drop, so no reply rows exist.
alter table public.job_comments drop column if exists parent_id;
drop index if exists idx_job_comments_parent_id;
