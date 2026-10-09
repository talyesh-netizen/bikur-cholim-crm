-- One place for notes about a person (decided by the director, Oct 8-9,
-- 2026): "About them" (profile notes) and "Private". The text in five
-- separate resident boxes is copied into "About them" as labelled notes,
-- dated when the resident was added. The boxes' columns are kept as a
-- backup; nothing is deleted. A "confidential" referral goes to Private
-- instead. Safe to re-run: a note that's already there isn't added again.

with src as (
  select r.id, r.created_at, 'Referred by: ' || r.referral_source as note
    from public.residents r
   where coalesce(r.referral_source, '') <> '' and r.referral_source not ilike '%confidential%'
  union all
  select r.id, r.created_at, 'Visiting: ' || r.visitation_needs
    from public.residents r where coalesce(r.visitation_needs, '') <> ''
  union all
  select r.id, r.created_at, 'Jewish background: ' || r.jewish_interests_background
    from public.residents r where coalesce(r.jewish_interests_background, '') <> ''
  union all
  select r.id, r.created_at, 'Visit how often: ' || r.preferred_visit_frequency
    from public.residents r where coalesce(r.preferred_visit_frequency, '') <> ''
  union all
  select r.id, r.created_at, 'Rabbi / shul: ' || r.rabbi_synagogue_connection
    from public.residents r where coalesce(r.rabbi_synagogue_connection, '') <> ''
)
insert into public.profile_notes (resident_id, raw_note, clean_note, created_by, created_at)
select src.id, src.note, src.note,
       (select id from public.profiles where full_name = 'Rabbi Tzvi Alyesh' limit 1),
       src.created_at
  from src
 where not exists (
   select 1 from public.profile_notes p
    where p.resident_id = src.id and p.clean_note = src.note
 );

-- A confidential referral belongs with the private notes.
insert into public.resident_private_notes (resident_id, notes)
select r.id, 'Referred by: ' || r.referral_source
  from public.residents r
 where r.referral_source ilike '%confidential%'
   and not exists (select 1 from public.resident_private_notes p where p.resident_id = r.id);

update public.resident_private_notes p
   set notes = p.notes || E'\nReferred by: ' || r.referral_source
  from public.residents r
 where p.resident_id = r.id
   and r.referral_source ilike '%confidential%'
   and p.notes not like '%Referred by: ' || r.referral_source || '%';
