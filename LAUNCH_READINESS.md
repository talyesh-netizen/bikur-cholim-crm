# Launch readiness — September 2026

Review done 2026-09-25, before staff start entering resident information
day to day. This file records what was checked, what was fixed, and the
settings that live **outside** this code (Supabase, Vercel, Resend) and
must be changed by a person in those dashboards.

## 1. Production at a glance

| | |
|---|---|
| Database & sign-in | Supabase project **Bikur Cholim CRM** (`sthmsqprvapaneigmtjw`), organization plan: **Free** |
| Web app | Vercel team `bikur-cholim-cleveland`, project **`bikur-cholim-crm`** |
| Production URL | **https://bikur-cholim-crm-eight.vercel.app** (confirmed as the address real sign-ins come from) |
| Production branch | lowercase **`main`** (Vercel deploys this) |
| Timezone | America/New_York for "today", due/overdue, greetings, filters and reports |

## 2. Vercel: one real project, two duplicates

All three projects are connected to the same GitHub repo
(`talyesh-netizen/bikur-cholim-crm`) and every push creates a deployment
in each — that's why the same commit "appears three times".

| Project | Created | Deployments | Serves production? | Env vars |
|---|---|---|---|---|
| **`bikur-cholim-crm`** | Jul 28 | **READY** | **Yes** — `bikur-cholim-crm-eight.vercel.app` | Supabase URL, anon key, service-role key (Production + Preview) |
| `bikur-cholim-crm-yh3w` | Sep 18 | every one **BLOCKED** | No | Same three Supabase vars (Production + Preview) |
| `bikur-cholim-crm-app` | Sep 18 | every one **BLOCKED** | No | Same three Supabase vars (Production + Preview) |

The two September 18 projects look like accidental re-imports of the same
repo. Their deployments are all BLOCKED (none has ever gone live), so
they do not serve users and **do not run the cron job** — Vercel only
runs crons on a project's live production deployment. They do hold a
copy of the **Supabase service-role key**, which is the main reason to
remove them.

Whether they point to the same Supabase project can't be proven without
reading secret values (not done, on purpose); they were created with the
same three variable names by the same person on the same day, so almost
certainly yes.

**Safe to remove?** Yes, after a 1-minute check in the Vercel dashboard
that neither has a custom domain you recognize. Recommended order:
1. In each duplicate: Settings → Git → **Disconnect** the repository
   (stops the triple deployments), then Settings → Environment Variables
   → delete `SUPABASE_SERVICE_ROLE_KEY`.
2. Then Settings → General → **Delete Project** for both duplicates.

Duplicate reminder emails are prevented in code as well: the reminder job
only runs when `CRON_SECRET` is set, so set it on `bikur-cholim-crm` only.

## 3. Vercel environment variables (canonical project `bikur-cholim-crm`)

Values were not read or printed — only whether each exists.

| Variable | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | — | public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | — | public by design; RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | — | secret, server-only (not `NEXT_PUBLIC_`) ✅ |
| `CRON_SECRET` | ❌ missing | ❌ | — | needed for reminders |
| `RESEND_API_KEY` | ❌ missing | ❌ | — | needed for reminders |
| `TASK_REMINDER_FROM_EMAIL` | ❌ missing | ❌ | — | needed for reminders |

No secret is exposed through a `NEXT_PUBLIC_` variable, and a scan of the
built browser bundle found no server secret names.

**Consider:** Preview deployments currently get the production
service-role key and production database. Preview URLs are behind Vercel
login, which limits the risk, but the cleaner setup is to remove
`SUPABASE_SERVICE_ROLE_KEY` from **Preview** (only needed to create staff
accounts) or point Preview at a separate test Supabase project.

## 4. Manual setup checklist

### Must do
- [ ] **Merge the launch-hardening pull request into `main`** (it
      deploys to production automatically).
- [ ] **Decide on the Supabase plan.** The organization is on the
      **Free** plan, which for a production system holding real resident
      data means:
      - the project **pauses automatically after about a week of low
        activity** (the app goes down until someone resumes it);
      - **no dashboard-restorable daily backups** — Supabase advises Free
        projects to export their own backups regularly;
      - **Leaked Password Protection is not available** (Pro plan
        feature).
      Upgrading to **Pro** removes all three. If staying on Free for now,
      an admin should download a backup weekly from **More → Backup**
      in the CRM (one .zip of every table) and store it on the
      organization's private drive, and watch for the pause-warning email.
- [ ] **Supabase → Authentication → Attack Protection (or Providers →
      Email) → turn on "Prevent use of leaked passwords"** (requires Pro).
      While there: set minimum password length to at least 10–12
      characters and require letters + digits.
- [ ] **Supabase → Authentication → URL Configuration:** confirm **Site
      URL** is `https://bikur-cholim-crm-eight.vercel.app` (password-reset
      links go there).
- [ ] Remove or disconnect the two duplicate Vercel projects (section 2).

### Only if you want the daily reminder email
- [ ] Create a Resend account, verify a sending domain (e.g.
      `bikurcholimcleveland.org`).
- [ ] On Vercel project `bikur-cholim-crm` → Settings → Environment
      Variables, **Production only**, add `CRON_SECRET` (a long random
      string), `RESEND_API_KEY`, `TASK_REMINDER_FROM_EMAIL`; then redeploy.
      The email says only how many follow-ups are due/overdue — no names.
      It runs daily at 12:00 UTC (8am EDT / 7am EST).

### Recommended soon
- [ ] Make lowercase `main` the GitHub **default branch** (Settings →
      Branches) and retire capital-M `Main` after confirming nothing on it
      is missing from `main`. Having both is how PRs merged to `Main`
      never reached production, and it breaks checkouts on Mac/Windows
      (case-insensitive filenames).
- [ ] Write down the access policy (who is Admin, who is
      facility-restricted, what happens on the day someone leaves).

## 5. Data to review

- **18 volunteer visits have no volunteer tagged** (dates Feb 22 – Aug
  25, 2026, at Anna Maria of Aurora ×9, Heritage of Lyndhurst ×7, Eliza
  Jennings Chagrin Falls ×1, The Ashton at Mayfield Heights ×1). None of
  them has a `contact_id` either, so nothing was guessed. They show
  **"Not tagged yet"** everywhere and are listed under **Data Quality →
  Volunteer visits missing a volunteer**, where someone who knows can tag
  them. No volunteers were assigned automatically.
- **Backup tables in `crm_backup`** (7 tables, created 2026-09-23 as
  "before" snapshots for two volunteer-visit repair passes): 239
  interaction rows, 157 interaction-volunteer links, 27 contacts, 2
  resident rows, 1 facility-history row. They contain real data, are not
  readable by app users or the public API, and have no retention note.
  Left untouched. Suggested: once the September 23 repair is confirmed
  correct, export them to secure storage (or decide they're no longer
  needed) and then drop them — a decision for a person, not the advisor
  warning. The "no primary key" advisor notices on them are harmless.
- **Unused indexes (5):** all small, recently added, and match real
  query patterns (facility access, organization lookups, the new review
  screen). Recommend keeping all of them for now.
- Structural checks at launch: 0 broken facility/resident links, 0
  invalid facility-history date ranges.
- All 1,351 existing interactions were bulk-imported with a date only
  (stored at noon UTC = 8am Eastern). They display on the correct day.

## 6. Security status

- Supabase security advisor: only remaining item is Leaked Password
  Protection (needs Pro — see above).
- RLS enabled on every public table; signed-out (anon) access to data:
  none; summary views use `security_invoker`; access helper functions not
  callable by anon.
- Facility-restricted access tested against production rules (43 checks,
  all rolled back, all pass): `supabase/checks/restricted_facility_access_check.sql`.
- Service-role key used only server-side (staff account creation, daily
  reminder job).

## 7. Runtime logs

Vercel runtime logs could not be read during this review (the Vercel
connection used lacked log permission for this team). Supabase's own
logs for the past 24 hours showed no database, RLS or API errors; one
burst of "refresh token not found" on Sep 24 (15:14 UTC) forced one
re-sign-in. It's worth glancing at **Vercel → bikur-cholim-crm → Logs**
filtered to errors after the first week of use.
