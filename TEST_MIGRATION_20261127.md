# Applying the Nov 27 database change to hosted TEST

TEST only (project `zhiinpkexoawuepeaamg`, the "Bikur Cholim CRM – Testing"
account). Never run this on the live project until it is approved.

## 1. Before: note the counts

Run in the TEST project's SQL editor and keep the numbers:

    select (select count(*) from interactions) as interactions,
           (select count(*) from residents)    as residents,
           (select count(*) from facilities)   as facilities,
           (select count(*) from tasks)        as tasks;

## 2. Apply

Paste the whole file `supabase/migrations/20261127000001_attempts_trips_passing.sql`
and run it once. It only adds things (a new kind, two optional columns,
two refreshed summary views). Undo, if ever needed:
`supabase/rollback/20261127000001_attempts_trips_passing_undo.sql`.

## 3. After: expected results

    -- a) same counts as in step 1 (nothing added or removed)
    select (select count(*) from interactions) as interactions,
           (select count(*) from residents)    as residents,
           (select count(*) from facilities)   as facilities,
           (select count(*) from tasks)        as tasks;

    -- b) the new columns exist: expect 3 rows
    select table_name, column_name from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'interactions'     and column_name = 'trip_id')
         or (table_name = 'residents'        and column_name = 'date_of_death')
         or (table_name = 'resident_summary' and column_name = 'last_attempt_at'));

    -- c) "Attempted visit" is allowed: expect true
    select pg_get_constraintdef(oid) like '%visit_attempt%'
      from pg_constraint where conname = 'interactions_interaction_type_check';

    -- d) nothing filled in yet: expect 0, 0, 0
    select (select count(*) from interactions where trip_id is not null),
           (select count(*) from interactions where interaction_type = 'visit_attempt'),
           (select count(*) from residents where date_of_death is not null);

    -- e) the summary views still answer (any number, no error)
    select count(*) from resident_summary;
    select count(*) from facility_summary;

Then tell Claude: it re-checks from its side (the new columns answer
instead of "does not exist") before the preview checks.
