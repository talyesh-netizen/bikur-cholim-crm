-- Extensions and shared helper functions used by every table that follows.
--
-- Plain-English summary: this file sets up small pieces of reusable
-- "plumbing" — like a stamp that automatically records when a row was
-- last changed — so we don't have to repeat that logic in every table.

-- gen_random_uuid() is built into PostgreSQL 13+ without needing an
-- extension, so no extension is required for ID generation.

-- Automatically keeps an `updated_at` column current on every update.
-- Every table below attaches this as a trigger, so "when was this last
-- changed" is always accurate without staff or the app having to
-- remember to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at with the current time on every row update. Attached to every table that has an updated_at column.';
