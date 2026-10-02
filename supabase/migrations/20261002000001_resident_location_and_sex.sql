-- Resident reconciliation fixes: current location can be unknown and sex can be recorded.
alter table public.residents alter column current_facility_id drop not null;
alter table public.residents add column if not exists sex text;
alter table public.residents drop constraint if exists residents_sex_check;
alter table public.residents add constraint residents_sex_check check (sex is null or sex in ('male','female'));
alter table public.residents drop constraint if exists residents_status_check;
alter table public.residents add constraint residents_status_check check (status in ('active','temporarily_hospitalized','location_unknown','moved_to_another_facility','returned_home','deceased','unable_to_reach','no_longer_receiving_services'));

create or replace function crm_private.create_initial_facility_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_facility_id is not null then
    insert into public.resident_facility_history (resident_id, facility_id, start_date, created_by)
    values (new.id, new.current_facility_id, (now() at time zone 'America/New_York')::date, new.created_by);
  end if;
  return new;
end;
$$;

create or replace function crm_private.record_facility_transfer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'America/New_York')::date;
begin
  if new.current_facility_id is distinct from old.current_facility_id then
    update public.resident_facility_history set end_date = v_today where resident_id = new.id and end_date is null;
    if new.current_facility_id is not null then
      insert into public.resident_facility_history (resident_id, facility_id, start_date)
      values (new.id, new.current_facility_id, v_today);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.transfer_resident(p_resident_id uuid,p_new_facility_id uuid,p_reason text default null,p_notes text default null)
returns public.residents language plpgsql set search_path = public as $$
declare v_old_facility_id uuid; v_exists boolean; v_resident public.residents;
begin
  select true,current_facility_id into v_exists,v_old_facility_id from public.residents where id=p_resident_id;
  if coalesce(v_exists,false)=false then raise exception 'Resident not found, or you do not have access to view them.'; end if;
  if v_old_facility_id=p_new_facility_id then raise exception 'That resident is already at this facility.'; end if;
  update public.residents set current_facility_id=p_new_facility_id,status=case when status='location_unknown' then 'active' else status end where id=p_resident_id returning * into v_resident;
  insert into public.interactions(interaction_type,facility_id,resident_id,staff_member_id,notes,outcome)
  values('other',p_new_facility_id,p_resident_id,auth.uid(),coalesce(p_notes,''),'Resident transferred to this facility.'||case when p_reason is not null then ' Reason: '||p_reason else '' end);
  return v_resident;
end;
$$;

create or replace view public.resident_summary as
select r.id,r.first_name,r.last_name,r.preferred_name,r.current_facility_id,r.room_number,r.phone_number,r.rabbi_synagogue_connection,r.jewish_interests_background,r.kosher_food_needs,r.holiday_support_needs,r.visitation_needs,r.preferred_visit_frequency,r.status,r.private_internal_notes,r.created_by,r.created_at,r.updated_at,r.referral_source,
f.name as current_facility_name,f.geographic_cluster_id as current_facility_cluster_id,
(select max(i.occurred_at) from public.interactions i where i.resident_id=r.id and i.interaction_type in ('resident_visit','volunteer_visit')) as last_visit_at,
(select min(t.due_date) from public.tasks t where t.resident_id=r.id and t.status in ('open','in_progress','waiting') and t.due_date is not null) as next_follow_up_date,
(select pc.id from public.resident_contacts pc where pc.resident_id=r.id and pc.is_primary_contact=true limit 1) as primary_contact_resident_contact_id,
r.sex,f.facility_type as current_facility_type
from public.residents r left join public.facilities f on f.id=r.current_facility_id;