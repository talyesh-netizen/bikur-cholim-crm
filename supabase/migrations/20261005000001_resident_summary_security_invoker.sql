-- resident_summary must run with the CALLER's permissions so the residents
-- access rules (active staff, facility restrictions) apply to it.
-- 20261002000001 rebuilt the view with "create or replace" and no
-- security_invoker option, so from Oct 2 the view ran as its owner and
-- skipped those rules (every signed-in account saw every resident). No
-- restricted or inactive accounts existed at the time. Restored Oct 5.
--
-- ANY future rebuild of this view must keep: with (security_invoker = true)
alter view public.resident_summary set (security_invoker = true);
