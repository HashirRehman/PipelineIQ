-- Doc 01 (line 341) says skills should be "soft-disabled via is_active
-- rather than deleted, so historical leads referencing a retired skill
-- still resolve" — the same pattern already used for seniority_levels.
-- The base Module 2 migration never added is_active to skills and still
-- grants a real hard DELETE; this brings it in line with the documented
-- design rather than building the skills-management UI around the gap.

alter table public.skills
  add column is_active boolean not null default true;

-- Case-insensitive uniqueness — directly serves doc 04's stated reason
-- this table exists ("an editable list... rather than free-text that gets
-- misspelled inconsistently").
create unique index skills_name_unique_ci on public.skills (lower(name));

drop policy skills_delete on public.skills;

revoke delete on public.skills from authenticated;

comment on table public.skills is
  'Admin-managed skill vocabulary. Soft-disabled via is_active, never hard-deleted, so historical engineer_skills rows referencing a retired skill still resolve.';
