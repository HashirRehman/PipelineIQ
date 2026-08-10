-- Leads ownership follows the PROFILE, not the creation-time snapshot.
--
-- leads.user_id is a permanent snapshot of who applied when the lead was
-- created. It drifts from reality in three ways:
--   * the applier's account is deleted (migration 14 unlinks user_id → NULL)
--   * the profile is reassigned to another user
--   * an Admin / BD Manager created the lead on behalf of a profile
--
-- In every case the lead still belongs to the profile, and per the permission
-- model the Business Developer assigned to that profile must see it ("only
-- their own data or the ones related to the profile they are assigned"). So
-- the owner branch of leads_select / leads_update is widened to also admit
-- the profile's CURRENT assigned user. The snapshot branch (user_id =
-- auth.uid()) stays, so the original applier keeps read access after a
-- reassignment — but edits follow the current profile owner.
--
-- Additive migration (no reset required): apply with `npm run migrate:up`.

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    is_admin()
    or is_bd_manager()
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (
    is_admin()
    or is_bd_manager()
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or is_bd_manager()
    or user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );
