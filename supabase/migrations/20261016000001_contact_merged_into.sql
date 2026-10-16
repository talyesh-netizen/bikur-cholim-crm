-- Verified duplicate contacts (decision A1, director, Oct 16, 2026).
--
-- An admin marks the extra record "Merged into" the one being kept. The
-- extra record is also made inactive, so every list and picker that
-- already shows only active contacts hides it; the search bar and its
-- own page read this link. Nothing is deleted or moved: its old visits,
-- resident and facility links stay exactly as they were.

alter table public.contacts
  add column if not exists merged_into_id uuid references public.contacts (id);

comment on column public.contacts.merged_into_id is
  'Set when an admin confirmed this contact is a duplicate of another. Hidden from everyday searches and lists; its history stays attached to it.';

create index if not exists contacts_merged_into_id_idx
  on public.contacts (merged_into_id) where merged_into_id is not null;

alter table public.contacts drop constraint if exists contacts_not_merged_into_self;
alter table public.contacts add constraint contacts_not_merged_into_self
  check (merged_into_id is null or merged_into_id <> id);

-- Only an admin may mark (or undo) a merge; any other change by staff
-- works as before.
create or replace function crm_private.protect_contact_merge()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.merged_into_id is distinct from old.merged_into_id
     and auth.uid() is not null
     and not crm_private.is_admin() then
    raise exception 'Only an admin can mark a contact as a duplicate.';
  end if;
  return new;
end;
$$;

revoke all on function crm_private.protect_contact_merge() from public, anon, authenticated;

drop trigger if exists protect_contact_merge on public.contacts;
create trigger protect_contact_merge
  before update of merged_into_id on public.contacts
  for each row execute function crm_private.protect_contact_merge();
