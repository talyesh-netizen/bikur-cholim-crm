# CRM backup and restore guide

Approved by the director on Nov 4, 2026 (Option B: Supabase Pro plus a
monthly off-site copy). Written for a non-technical admin. Every step is
something you click in a web page.

Account set-up (Nov 4, 2026): the live CRM is in the Supabase account
**Bikur Cholim Cleveland** on the **Pro plan ($25 a month)**, paid with the
organization's card. The TEST project (fake data only) was moved to a
separate free account, **Bikur Cholim CRM – Testing**, so it costs nothing.
The tax-exemption certificate goes to tax-documents@supabase.io.

## What protects the CRM

| Layer | What it is | How far back | Who looks after it |
|---|---|---|---|
| 1. Supabase daily backups (Pro plan) | Supabase copies the whole database every day, including staff sign-ins | The last 7 days | Automatic |
| 2. Monthly off-site copy | The admin downloads **More → Backup** and saves it to the organization's private drive | Every month we keep | An admin, once a month (below) |
| 3. Internal repair snapshots | Copies saved inside the database before data fixes in Sept and Oct 2026 (`crm_backup`) | Those dates only | Kept until the restore test passes, then a person decides |

What Supabase's daily backups **do** include: every CRM table and record,
staff accounts and their passwords (stored scrambled), and the database
rules for who can see what.

What they **don't** include, so the guide below covers these separately:
- Photo files (Supabase Storage). There are none yet. Once photos are
  added, the monthly procedure needs a photo step too.
- Supabase settings such as sign-in email templates and password rules.
  These are written down in `LAUNCH_READINESS.md`.
- The website itself. That lives in GitHub and Vercel, not the database.

Point-in-Time Recovery (restoring to any minute, not just once a day) is
an extra add-on, about $100 a month or more. It is **not** part of
Option B.

## Monthly off-site backup (about 10 minutes)

Do this on the first working day of each month, and before any big change.

1. Sign in to the CRM as an admin.
2. Open **More → Backup** and click **Download a full backup**. Wait until
   the .zip file finishes downloading. It can take up to a minute.
3. Open the .zip and then **READ-ME.txt**. Check that the counts look
   normal. `residents`, `interactions` and `change_log` should never be 0
   or much smaller than last month.
4. Move the .zip (don't copy it) into the organization's private, restricted
   drive folder **CRM Backups**. Keep the name it came with, for example
   `crm-backup-2026-12-01.zip`.
5. Empty the file out of Downloads and the computer's trash.
6. Open Supabase (supabase.com, sign in) → **Bikur Cholim CRM** project →
   **Database → Backups**. Check that the newest backup is from the last
   day or so.
7. Write one line in the log at the bottom of this page (or in the
   drive folder): date, who did it, "counts OK", "Supabase backup seen".
8. Delete monthly copies older than 12 months (proposed rule, still
   waiting for approval).

The file contains real resident information. Never email it, never save
it to a personal drive or a USB stick, and never leave it in Downloads.

## How to restore: pick the smallest fix

### A. A few entries were changed or removed by mistake

Don't restore the whole database.
- A voided entry can be restored from the entry itself.
- For an edit, **change history** shows what the entry used to say.
  Ask Claude to put it back.

### B. Something larger went wrong in the last 7 days

Restore a **side copy**. The live CRM keeps running untouched while the
copy is made.
1. Supabase → **Bikur Cholim CRM** → **Database → Backups → Restore to a
   new project**.
2. Pick the newest backup from **before** the problem happened, then
   click **Restore**. Supabase shows the cost first. A copy costs about
   1 cent an hour while it exists.
3. Tell Claude the new project's name. Claude compares the copy with the
   live CRM and copies back only what was lost.
4. Once that's confirmed, delete the side copy (**Project settings →
   General → Delete project**) so you stop paying for it.

Only if the live database is badly broken: **Database → Backups →
Scheduled backups → Restore** on the live project. The CRM is offline
while this runs (minutes, at our size), and anything entered after that
backup is lost. Re-enter it from staff notes or from the change history.

### C. Supabase can't be used, or the problem is older than 7 days

Rebuild from the newest monthly .zip. The table design is saved in GitHub
(`supabase/migrations`), so Claude or a technical helper can build a
fresh database and load the spreadsheets back into it. Staff then set
new passwords with "Forgot password", because the .zip doesn't contain
sign-ins. This is the last resort. It's slower, but nothing is lost up
to the date of that .zip.

## Restore test record

The first test is planned straight after the Pro upgrade. Results go here.

| Date | Backup used | Tables matched (of 23) | Staff sign-ins matched | Result | By |
|---|---|---|---|---|---|
| | | | | | |

Baseline counts from the live CRM, Nov 4, 2026, 20:41 UTC (before the upgrade):
profiles 5, geographic_clusters 13, facilities 134, residents 234,
resident_facility_history 258, contacts 370, resident_contacts 72,
facility_contacts 213, interactions 1,844, interaction_volunteers 107,
tasks 58, profile_facility_access 0, organizations 45,
organization_contacts 49, profile_notes 82, change_log 1,343,
resident_private_notes 159, facility_media 0, interaction_contacts 18,
interaction_team_members 20, duplicate_reviews 0, report_snapshots 35,
stories 0. Staff sign-in accounts (auth.users) 6, sign-in identities 6.
Photo files in storage: 0.

## Monthly log

| Date | Who | Counts OK | Supabase backup seen | Notes |
|---|---|---|---|---|
| | | | | |
