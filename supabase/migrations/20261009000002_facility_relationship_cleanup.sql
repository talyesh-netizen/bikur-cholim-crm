-- Facility relationship labels down to the four the form offers
-- (approved by the director, Oct 9, 2026). Only the label changes.

update public.facilities set engagement_status = 'recurring_visits'
 where engagement_status in ('active_facility', 'recurring_programming');

update public.facilities set engagement_status = 'initial_contact'
 where engagement_status = 'staff_relationship_developing';

-- "Follow up needed" becomes a real follow-up, so the reminder isn't lost.
insert into public.tasks (title, task_category, facility_id, assigned_to, created_by)
select 'Follow up with ' || f.name, 'facility_follow_up', f.id, p.id, p.id
  from public.facilities f
  cross join (select id from public.profiles where full_name = 'Rabbi Tzvi Alyesh' limit 1) p
 where f.engagement_status = 'follow_up_needed'
   and not exists (
     select 1 from public.tasks t where t.facility_id = f.id and t.status <> 'completed'
   );

update public.facilities set engagement_status = 'initial_contact'
 where engagement_status = 'follow_up_needed';
