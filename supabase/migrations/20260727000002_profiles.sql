-- profiles: one row per staff member who can sign in.
--
-- Plain-English summary: Supabase's built-in `auth.users` table handles
-- the actual sign-in credentials (password, email verification) and we
-- never touch it directly. This table holds the extra information the
-- app needs about that person — their display name and whether they are
-- Staff or Admin — linked to that same account by a shared ID.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per staff member. Extends Supabase auth.users with the app-specific info (display name, role, active flag).';
comment on column public.profiles.role is
  'staff = normal working role. admin = staff permissions plus managing user accounts and the geographic cluster list.';
comment on column public.profiles.active is
  'Whether this person currently has access. Deactivating an account (rather than deleting it) preserves the history of what they created/changed.';

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatically creates a profile row whenever someone signs up through
-- Supabase Auth, so staff never have to manually create a matching
-- "profiles" row themselves. New accounts default to the Staff role;
-- an Admin can promote someone to Admin afterward.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper function used throughout the rest of the security rules to ask
-- "is the currently signed-in person an Admin?". It's marked `security
-- definer`, which means it's allowed to peek at the profiles table on
-- the caller's behalf even though the caller's own row-level security
-- would otherwise apply — this avoids the security rules checking
-- themselves in an endless loop.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

comment on function public.is_admin() is
  'Returns true if the signed-in user is an active Admin. Used by security rules across the app.';

-- Helper function: "is the currently signed-in person an active member
-- of staff at all (Staff or Admin)?" Every table's security rules
-- require at least this before allowing any access.
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

comment on function public.is_active_staff() is
  'Returns true if the signed-in user has an active Staff or Admin account. The baseline check for all data access.';

-- Safety net: the "update your own profile" policy above only checks
-- *which row* is being changed, not *which fields*. Without this
-- trigger, a signed-in staff member could technically edit their own
-- `role` or `active` field and grant themselves Admin access. This
-- trigger blocks that: only an Admin is allowed to change a `role` or
-- `active` value, on any row, including their own.
--
-- The one exception is auth.uid() being null, which means this change
-- isn't coming from a signed-in app user at all — it's a direct
-- database/service-role action (for example, an organization
-- administrator running SQL directly to set up the very first Admin
-- account, before any Admin exists yet to grant that role through the
-- app). That bootstrapping step requires already having direct database
-- access, which is a strictly higher level of trust than being signed
-- into the app.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.is_admin() then
    raise exception 'Only an admin can change a profile''s role or active status.';
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

alter table public.profiles enable row level security;

-- Any signed-in, active staff member can see the list of staff (needed
-- for things like "assign this task to..." dropdowns and "visit logged
-- by Talya" displays).
create policy "profiles are readable by active staff"
  on public.profiles for select
  to authenticated
  using (public.is_active_staff());

-- A person can update their own display name.
create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update anyone's profile (e.g., changing a role, or
-- deactivating an account for someone who has left).
create policy "admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Note: there is intentionally no INSERT or DELETE policy for regular
-- use. New profile rows are created automatically by the
-- handle_new_user trigger above when someone signs up; there is no
-- Phase One workflow for deleting a profile (deactivate instead).
