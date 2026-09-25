# Privacy, Security, and Architectural Concerns

_Last updated: 2026-09-25 (launch review)_

This document explains (1) what protects the information in this CRM
today, and (2) what the software **cannot** guarantee by itself. It is
written for the department's leadership, not only for developers.

## Where things stand

- The CRM is **in production use**. It is connected to the department's
  production Supabase project and holds **real operational data** about
  facilities, residents, family members, volunteers, staff contacts,
  visits and follow-up tasks.
- Sign-in and database row-level security are implemented and were
  tested before launch, including accounts limited to specific
  facilities (see "What was tested" below).
- **This is not a legal or compliance certification.** Nothing here
  claims compliance with HIPAA, Ohio privacy law, or any other standard.
  The organization still needs its own written privacy, access and
  incident policies, and an independent security/compliance review may
  still be appropriate — see the last section.

## What protects the information

### 1. Nobody gets in without signing in
Every page and data request requires a signed-in session through
Supabase Auth. Accounts are created by an admin; new sign-ins start
inactive until an admin activates them. There is no public, family or
self-registration access.

### 2. The database enforces access, not just the screens
Every table has PostgreSQL **row-level security** (RLS). Even a mistake
in the app's code, a hand-typed URL, or someone calling the database API
directly cannot return rows the database's rules don't allow:

- Signed-out visitors (the public "anon" key) can read nothing.
- An inactive account can read nothing.
- **Facility-restricted accounts** (an admin sets a staff member to
  "restricted" and chooses their facilities) can only see and change:
  those facilities; residents currently at them; interactions, tasks
  and facility history for those residents/facilities; and contacts
  linked to them. Org-wide contacts that aren't tied to any resident or
  facility (volunteers, community partners) stay visible to everyone.
  A restricted account also cannot add new facilities, move a resident
  into or out of a facility it can't access, or give itself more access.
- The two summary views (`facility_summary`, `resident_summary`) run
  with the viewer's own permissions (`security_invoker`), so they can't
  bypass these rules.

### 3. The all-powerful "service role" key stays on the server
The Supabase service-role key bypasses RLS, so it is used in exactly two
server-only places: an admin creating/removing a staff sign-in, and the
daily reminder job (which has no signed-in user and is protected by its
own secret — see below). It is never given a `NEXT_PUBLIC_` name, so it
is never sent to anyone's browser. Other secrets (`CRON_SECRET`,
`RESEND_API_KEY`) are handled the same way.

### 4. Database helper functions are locked down
The functions the access rules rely on (`crm_private.*`) live in a schema
the public API does not expose, run with a fixed `search_path`, and can
only be executed by signed-in users. The resident-transfer and
save-volunteers functions run with the *caller's* permissions, so they
are subject to the same facility rules as everything else.

### 5. History is preserved, not deleted
Records are deactivated, completed, cancelled or retired rather than
deleted. Moving a resident keeps their full facility history and visit
log. (The only hard delete in the app is an admin removing a staff
sign-in that has never been used; the database refuses it for anyone
linked to existing records.)

### 6. Saves never fail silently
If a visit or edit can't be saved — lost connection, access denied, a
record that no longer exists — the app says so plainly and keeps what
was typed. Double taps and retries can't create duplicate visits. Times
are entered and shown in Cleveland time (America/New_York).

### 7. Secrets are never stored in the code
Connection details and keys live in environment variables (Vercel
project settings, or a local `.env.local` that Git ignores).

## Information that leaves the CRM

Anything sent outside the CRM is out of our control once sent (other
people's inboxes, phones, email providers' servers, downloaded files).
The rule is: **send the minimum, link back to the CRM for details.**

- **Daily task-reminder email** (optional; sent through Resend when
  configured). It contains only the staff member's first name and *how
  many* follow-ups are overdue or due today, with a link to their task
  list. It does **not** include resident names, facility names, task
  titles, categories or notes — task titles are free text and often name
  a resident or relative. Anyone adding to this email should keep it
  that way.
- **"New task assigned to you" email** (same Resend setup). Sent the
  moment someone assigns a task to another staff member. It contains
  only the recipient's first name, who assigned it, the due date and a
  link to the task -- the same "no names, no titles, no notes" rule.
- **CSV impact report** (for funders/board). Aggregate counts only — no
  resident names, notes or other identifying details.
- **Full backup download** (admins only, More → Backup). This one is
  deliberately complete — every record, including resident details — so
  it must be stored only on the organization's private, access-controlled
  drive, never emailed, and old copies deleted. It is read through the
  admin's own sign-in (database access rules still apply) and is not
  cached by the browser.
- **Password-reset and sign-in emails** come from Supabase Auth and
  contain no resident information.

Before adding any other integration (text messages, calendar sync,
AI tools, a new email type), decide explicitly what information it
would carry and whether it needs to.

## What was tested before launch (2026-09-25)

- A temporary restricted account (one facility), run against the real
  production rules inside a transaction that was rolled back, could not
  read, create, edit, move or re-link anything at another facility —
  43 checks, all passing. The script is kept at
  `supabase/checks/restricted_facility_access_check.sql` and is safe to
  re-run after any security change.
- Browser tests on a local copy with fictional data: every main workflow
  as admin and as staff, restricted-account URL guessing/search/dashboard/
  export, and every screen at 360/390/430 px phone widths.

## What still needs a person or a policy (not code)

- **Supabase dashboard settings** that can't be set from this code —
  notably **Leaked Password Protection** (Authentication → Attack
  Protection). See `LAUNCH_READINESS.md` for the exact list.
- **A written access policy.** Who is Admin vs. Staff; who should be
  facility-restricted; what happens the day someone leaves (set them to
  Inactive immediately); how often access is reviewed.
- **Compliance determination.** Whether any of this is "protected health
  information" in the organization's context, and whether a Business
  Associate Agreement with Supabase (and Vercel/Resend) is needed, is a
  question for someone qualified in healthcare/social-services privacy.
- **Retention and backup policy.** Supabase keeps automatic backups per
  its plan; the organization should decide and write down how long
  records and backup copies are kept. (There are also point-in-time
  repair snapshots in the database's `crm_backup` schema from a
  September 2026 data fix; they are not reachable by app users, but
  their retention should be decided — see `LAUNCH_READINESS.md`.)
- **Incident response.** What to do if a phone or laptop with a signed-in
  session is lost, a password is compromised, or an account is misused.
- **Independent security review / penetration test**, if the
  organization's risk tolerance or funders call for one.

## A note on architecture-level concerns (non-privacy)

- **Single production database.** New features should be tried against
  a separate development/test Supabase project, never production.
- **No offline support.** Staff need a connection while logging a visit.
  If a save fails, the form keeps the entry and says it was not saved —
  but it can't queue it for later.
