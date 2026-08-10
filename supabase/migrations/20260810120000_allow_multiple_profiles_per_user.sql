-- Profiles: a user may own multiple profiles, but each profile still belongs
-- to at most one user. The UNIQUE on profiles.user_id enforced the old 1:1
-- rule (one profile per user); dropping it lets several profile rows share
-- the same owner. "At most one user per profile" needs no constraint — the
-- user_id column is a single FK per row.
alter table public.profiles drop constraint if exists profiles_user_id_key;

-- The unique constraint carried an implicit index that backed the
-- profiles.user_id = auth.uid() lookups (RLS, discovery feed, profiles list);
-- replace it with a plain index so those queries stay fast.
create index idx_profiles_user_id on public.profiles (user_id);
