# Local test harness (not part of the real app)

This folder exists purely so the database design in `supabase/migrations/`
can be tested on this machine, where a full Supabase stack (which needs
Docker) isn't available.

It recreates *just enough* of Supabase's `auth` schema — a minimal
`auth.users` table and the `auth.uid()` function that Supabase's real
row-level security policies rely on — to run the real migration files
against a plain local PostgreSQL server and verify:

- every table and constraint is created without errors,
- the "move a resident" trigger correctly rewrites facility history,
- the "only one Primary Contact per resident" rule is actually enforced,
- the row-level security rules actually block/allow access the way they
  are supposed to (e.g., a signed-out user sees nothing; a Staff account
  cannot promote itself to Admin; only Admins can manage geographic
  clusters).

**This is not used by the real application and is never deployed.** Once
a real Supabase project exists, the files in `supabase/migrations/` are
applied there directly (Supabase already provides the real `auth` schema),
and this stand-in is not part of that project at all.

## Running it

```
bash supabase/local-test/run.sh
```

This wipes and rebuilds a local `bikur_cholim_dev` database from scratch
every time, so it's always safe to re-run.
