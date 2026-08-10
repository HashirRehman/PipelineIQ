-- Permanent user deletion (Team page "Delete user").
--
-- Deleting a user removes only the user (auth identity + public.users row)
-- and their comments; everything else belongs to the profile and simply
-- loses its user link:
--   * job_comments.user_id       — ON DELETE CASCADE (existing FK)
--   * leads.user_id              — becomes nullable, ON DELETE SET NULL
--   * job_profile_states.user_id — ON DELETE SET NULL
--   * profiles.user_id           — ON DELETE SET NULL (existing FK)
--
-- RLS had no delete policies, so add an admin-only users_delete policy to
-- keep the operation inside RLS (no service-role table writes).
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

create policy users_delete on public.users
  for delete to authenticated using (is_admin());

-- leads.user_id was NOT NULL, which blocked deleting a user who owned leads;
-- make it nullable and unlink on delete (a lead belongs to its profile, not
-- to the user who happened to apply with it).
alter table public.leads drop constraint if exists leads_user_id_fkey;
alter table public.leads alter column user_id drop not null;
alter table public.leads
  add constraint leads_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

-- Same unlinking for application-state rows (already nullable — add the
-- on-delete behavior so deleting a user clears their action references).
alter table public.job_profile_states drop constraint if exists job_profile_states_user_id_fkey;
alter table public.job_profile_states
  add constraint job_profile_states_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;
