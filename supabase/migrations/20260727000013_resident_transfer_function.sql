-- transfer_resident(): the one, well-defined way the app moves a
-- resident from one facility to another.
--
-- Plain-English summary: this bundles the "move a resident" action into
-- a single, all-or-nothing operation: it updates the resident's current
-- facility (which automatically triggers the facility-history
-- bookkeeping from the previous migration) and adds a note to the
-- interaction log that the move happened, so the transfer itself is
-- visible in the resident's timeline. Because it's one database
-- operation, it either fully succeeds or fully fails — there's no
-- in-between state where the resident's facility changed but the
-- history didn't get recorded.
--
-- This function deliberately runs with the CALLER's own permissions
-- (not elevated "security definer" permissions), so the same active
-- staff-only rules already defined on the residents and interactions
-- tables apply automatically here too.

create or replace function public.transfer_resident(
  p_resident_id uuid,
  p_new_facility_id uuid,
  p_reason text default null,
  p_notes text default null
)
returns public.residents
language plpgsql
set search_path = public
as $$
declare
  v_old_facility_id uuid;
  v_resident public.residents;
begin
  select current_facility_id into v_old_facility_id
    from public.residents
    where id = p_resident_id;

  if v_old_facility_id is null then
    raise exception 'Resident not found, or you do not have access to view them.';
  end if;

  if v_old_facility_id = p_new_facility_id then
    raise exception 'That resident is already at this facility.';
  end if;

  update public.residents
    set current_facility_id = p_new_facility_id
    where id = p_resident_id
    returning * into v_resident;

  insert into public.interactions (
    interaction_type, facility_id, resident_id, staff_member_id, notes, outcome
  ) values (
    'other',
    p_new_facility_id,
    p_resident_id,
    auth.uid(),
    coalesce(p_notes, ''),
    'Resident transferred to this facility.'
      || case when p_reason is not null then ' Reason: ' || p_reason else '' end
  );

  return v_resident;
end;
$$;

comment on function public.transfer_resident(uuid, uuid, text, text) is
  'Moves a resident to a new facility, updates their facility history automatically (via trigger), and logs the transfer in the interaction log — all in one all-or-nothing operation.';

revoke all on function public.transfer_resident(uuid, uuid, text, text) from public, anon;
grant execute on function public.transfer_resident(uuid, uuid, text, text) to authenticated;
