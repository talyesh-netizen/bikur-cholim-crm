-- profile_notes had every table permission granted to both signed-out
-- (anon) and signed-in users. Row-level security still kept notes
-- private, but the app only ever adds and reads profile notes, so grant
-- exactly that and nothing to signed-out visitors -- the same pattern as
-- the other tables.
revoke all on public.profile_notes from anon, authenticated;
grant select, insert on public.profile_notes to authenticated;
