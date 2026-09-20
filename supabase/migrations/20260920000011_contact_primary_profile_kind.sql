-- Lets a contact's main color/identity be based on their primary
-- linked facility or organization instead of always their
-- contact_type -- e.g. a volunteer whose most useful label is "our
-- person at Menorah Park" rather than "Volunteer".

alter table public.contacts
  add column primary_profile_kind text not null default 'contact_type'
    check (primary_profile_kind in ('contact_type', 'facility', 'organization'));

comment on column public.contacts.primary_profile_kind is
  'What decides this contact''s main color/identity in the app: their contact_type (default), their primary linked facility''s region color, or their primary linked organization''s type color. Lets staff override the default for someone whose most useful label is "our person at X" rather than their type -- e.g. a volunteer who is really known as the Menorah Park contact.';
