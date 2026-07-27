-- Minimal stand-in for the parts of Supabase's built-in `auth` schema
-- that our migrations and RLS policies depend on. See README.md in this
-- folder — this file is ONLY for local testing on a plain PostgreSQL
-- server and is never applied to a real Supabase project.

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Real Supabase reads the signed-in user's ID out of the JWT that
-- PostgREST attaches to each request as a session setting. We simulate
-- that here so RLS policies behave identically to how they will in
-- production: in a psql session, run
--   set local request.jwt.claims = '{"sub":"<uuid>"}';
--   set local role authenticated;
-- to "sign in" as a given user for the rest of that transaction.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

-- Matches Supabase's standard Postgres roles closely enough for our
-- policies (which only reference `authenticated`).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

-- Supabase's real project grants broad table-level privileges to these
-- roles and relies on row-level security to do the actual restricting —
-- we mirror that here.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
