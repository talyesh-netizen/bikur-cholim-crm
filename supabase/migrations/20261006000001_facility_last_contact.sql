-- A facility's "last visit" now means the last time anything was logged
-- there (resident visit, staff conversation, delivery, program, or the
-- imported "Facility Visit" entries, which are filed as "Other").
-- Before this, only four visit types counted, so 300+ imported facility
-- visits were ignored and ~30 active facilities showed as never visited.
--
-- Same columns, same order, same name (last_visit_at) so nothing that
-- reads the view changes; security_invoker kept so each person still
-- only sees facilities their access allows.
create or replace view public.facility_summary
with (security_invoker = true) as
 SELECT f.id,
    f.name,
    f.facility_type,
    f.address,
    f.city,
    f.zip,
    f.main_phone,
    f.website,
    f.parent_healthcare_group,
    f.geographic_cluster_id,
    f.approx_jewish_resident_count,
    f.jewish_residents_currently_known,
    f.engagement_status,
    f.visit_priority,
    f.recommended_visit_frequency,
    f.kosher_food_availability,
    f.notes,
    f.active,
    f.created_by,
    f.created_at,
    f.updated_at,
    gc.name AS geographic_cluster_name,
    ( SELECT max(i.occurred_at) AS max
           FROM interactions i
          WHERE i.facility_id = f.id) AS last_visit_at,
    ( SELECT count(*) AS count
           FROM residents r
          WHERE r.current_facility_id = f.id AND r.status = 'active'::text) AS active_resident_count
   FROM facilities f
     LEFT JOIN geographic_clusters gc ON gc.id = f.geographic_cluster_id;
