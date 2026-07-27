-- ============================================================================
-- Module 2 — reassign_engineer_bd(): atomic close-old/open-new for
-- engineer_bd_assignments. Backs assignEngineerToBd / unassignEngineerFromBd.
-- ============================================================================
create or replace function public.reassign_engineer_bd(
  p_engineer_id     uuid,
  p_old_bd_user_id  uuid,
  p_new_bd_user_id  uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_old_bd_user_id is null and p_new_bd_user_id is null then
    raise exception 'Must provide an old BD, a new BD, or both.';
  end if;

  if p_old_bd_user_id is not null and p_old_bd_user_id = p_new_bd_user_id then
    raise exception 'Old and new BD must be different.';
  end if;

  if p_old_bd_user_id is not null then
    update public.engineer_bd_assignments
    set unassigned_at = now()
    where engineer_id = p_engineer_id
      and bd_user_id = p_old_bd_user_id
      and unassigned_at is null;

    if not found then
      raise exception 'No active assignment found for this engineer and BD.';
    end if;
  end if;

  if p_new_bd_user_id is not null then
    if exists (
      select 1 from public.engineer_bd_assignments
      where engineer_id = p_engineer_id
        and bd_user_id = p_new_bd_user_id
        and unassigned_at is null
    ) then
      raise exception 'This BD is already assigned to this engineer.';
    end if;

    insert into public.engineer_bd_assignments (engineer_id, bd_user_id, assigned_by)
    values (p_engineer_id, p_new_bd_user_id, auth.uid());
  end if;
end;
$$;

comment on function public.reassign_engineer_bd(uuid, uuid, uuid) is
  'Atomically closes an old engineer_bd_assignments row and/or opens a new one — one function call, one transaction, so assignEngineerToBd/unassignEngineerFromBd can never leave an engineer with a phantom double-active or zero-active assignment.';
