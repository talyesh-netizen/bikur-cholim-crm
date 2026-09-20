-- Adds volunteer-specific profile fields directly to contacts, rather
-- than a separate volunteers table: every volunteer already has a
-- contacts row, so this is a small, always-optional extension of it,
-- not a new entity.

alter table public.contacts
  add column background_check_status text not null default 'not_started'
    check (background_check_status in ('not_started', 'pending', 'cleared', 'expired')),
  add column background_check_date date,
  add column availability_notes text;

comment on column public.contacts.background_check_status is
  'Volunteer background-check status. Meaningful only for contact_type = volunteer, but kept as a plain column (not a separate table) since every contact already has one row and this is a small, always-optional field.';
comment on column public.contacts.background_check_date is
  'When the background check was completed/cleared (or, for expired, when it expired) -- shown alongside background_check_status.';
comment on column public.contacts.availability_notes is
  'Free-text volunteer availability, e.g. "Tuesdays and Thursdays, mornings." Meaningful only for contact_type = volunteer.';
