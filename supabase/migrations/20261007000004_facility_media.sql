-- Private photo/media attachments for facility impact stories.
-- Photos stay in a private Supabase Storage bucket and are only visible
-- to signed-in staff who can access the linked facility.

create table public.facility_media (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  interaction_id uuid references public.interactions(id) on delete set null,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  caption text,
  usage_scope text not null default 'internal_only'
    check (usage_scope in ('internal_only','approved_for_reporting','approved_for_public')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, sha256)
);

comment on table public.facility_media is
  'Private photos attached to a facility and optionally to one interaction/program. Usage scope records whether the image may leave the CRM.';
comment on column public.facility_media.usage_scope is
  'internal_only = CRM only; approved_for_reporting = may be used in private reports; approved_for_public = approved for public-facing use.';

create index facility_media_facility_created_idx
  on public.facility_media (facility_id, created_at desc);
create index facility_media_interaction_idx
  on public.facility_media (interaction_id)
  where interaction_id is not null;

create trigger set_updated_at
  before update on public.facility_media
  for each row execute function public.set_updated_at();

-- The linked interaction must belong to the same facility. The function
-- is trigger-only and is not exposed as an API endpoint.
create or replace function crm_private.validate_facility_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.interaction_id is not null
     and not exists (
       select 1 from public.interactions i
       where i.id = new.interaction_id
         and i.facility_id = new.facility_id
     ) then
    raise exception 'The linked interaction must belong to the same facility.';
  end if;

  if tg_op = 'UPDATE' and (
    new.facility_id is distinct from old.facility_id
    or new.storage_path is distinct from old.storage_path
    or new.original_filename is distinct from old.original_filename
    or new.mime_type is distinct from old.mime_type
    or new.size_bytes is distinct from old.size_bytes
    or new.sha256 is distinct from old.sha256
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Stored photo identity fields cannot be changed.';
  end if;

  return new;
end;
$$;

revoke all on function crm_private.validate_facility_media() from public, anon, authenticated;

create trigger validate_facility_media
  before insert or update on public.facility_media
  for each row execute function crm_private.validate_facility_media();

alter table public.facility_media enable row level security;

grant select, insert, update on public.facility_media to authenticated;
grant all on public.facility_media to service_role;

create policy "facility media readable with facility access"
  on public.facility_media for select
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
  );

create policy "active staff can add facility media"
  on public.facility_media for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
  );

create policy "active staff can edit facility media details"
  on public.facility_media for update
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
  )
  with check (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
  );

-- No DELETE policy on facility_media: once a photo is successfully
-- attached, its audit record is preserved. Storage DELETE below exists
-- only so the uploader can clean up an object if metadata saving fails.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'impact-media',
  'impact-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are always <facility-uuid>/<random-file-name>. The CASE
-- prevents malformed paths from being treated like a null/unrestricted
-- facility by can_access_facility().
create policy "impact media objects readable with facility access"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'impact-media'
    and crm_private.is_active_staff()
    and case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then crm_private.can_access_facility(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy "active staff can upload impact media objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'impact-media'
    and crm_private.is_active_staff()
    and case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then crm_private.can_access_facility(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy "uploaders can clean up failed impact media uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'impact-media'
    and owner = (select auth.uid())
    and case
      when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then crm_private.can_access_facility(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
