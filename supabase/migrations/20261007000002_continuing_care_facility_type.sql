-- "Continuing care community": one campus offering several levels of
-- care (independent, assisted, memory care, nursing) -- e.g. the Judson
-- Senior Living campuses and Kendal at Oberlin, which until now could
-- only be typed "Other". Approved by the director, Oct 6, 2026.

alter table public.facilities drop constraint facilities_facility_type_check;

alter table public.facilities add constraint facilities_facility_type_check
  check (facility_type in (
    'nursing_home',
    'assisted_living',
    'rehabilitation_center',
    'memory_care',
    'independent_living',
    'senior_apartment',
    'continuing_care',
    'hospital',
    'other'
  ));
