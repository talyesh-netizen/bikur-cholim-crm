# Bikur Cholim of Cleveland — Senior Living Resident Support Services CRM

An internal web application for the Senior Living Resident Support Services
department. It helps staff keep track of facilities, Jewish residents in
those facilities, family and staff contacts, visits and other interactions,
and follow-up tasks — in one place, instead of spreadsheets and memory.

This is **not** a public website. It is only for department staff, and it
requires signing in.

> **In production use (September 2026).** The app is live, connected to
> the department's production Supabase database, and holds real
> operational information about facilities, residents, families,
> volunteers and visits. See `PRIVACY_AND_SECURITY.md` for how that
> information is protected and what still depends on organizational
> policy, and `LAUNCH_READINESS.md` for the launch checklist and the
> manual settings that live outside this code.

## What this application does (Phase One)

- **Dashboard** — a quick summary: how many facilities and residents we
  track, visits and programs done this month, open follow-up tasks, and
  who hasn't been visited in a while.
- **Facilities** — a directory of nursing homes, assisted living
  communities, rehab centers, and similar places, with notes on
  engagement, visit priority, and kosher food availability.
- **Residents** — a directory of the Jewish residents we support, linked
  to their facility, with notes on their needs and preferences, and a
  clean way to move them if they transfer facilities.
- **Contacts** — facility staff, family members, rabbis, synagogue
  contacts, volunteers, and other partners.
- **Interaction log** — a single record of every visit, phone call,
  program, or piece of communication, connected to the relevant facility,
  resident, and/or contact.
- **Tasks & follow-up** — a simple to-do list tied to facilities,
  residents, and contacts, so nothing falls through the cracks.
- **Search & filters** — find what you need by facility, city, resident,
  visit date, engagement status, task status, and more.

## What this is not (yet)

On purpose, this does **not** include text messaging, a portal for
families to log in themselves, maps, automatic volunteer reminders,
calendar syncing, or a knowledge base. (It does have a CSV impact
report for funders — aggregate numbers only — and an optional daily
email to staff saying how many follow-ups are due.) See `PLAN.md` for
the reasoning.

## Who can use it

Everyone who uses this application must sign in with an account created
for them. There are two roles to start:

- **Staff** — the normal working role. Can view and edit facilities,
  residents, contacts, interactions, and tasks.
- **Admin** — everything Staff can do, plus the ability to manage which
  staff have accounts.

Separately from role, an admin can limit any staff account to a chosen
list of facilities ("restricted" access). A restricted account only sees
those facilities and the residents, visits, tasks and contacts connected
to them. This is enforced by the database itself, not just the screens.

There is no public or family-facing access.

## Real information is in this system

The production database contains **real operational data** (at launch:
about 126 facilities, 178 residents, 280 contacts and 1,351 logged
interactions). Treat every screen, export and screenshot accordingly.

- Sign-in (Supabase Auth) and database row-level security are in place
  and have been tested, including facility-restricted accounts.
- That is technical protection, not a compliance certification. The
  department still needs its own written privacy and access policies,
  and an independent security/compliance review may still be
  appropriate. See `PRIVACY_AND_SECURITY.md`.
- Anything that leaves the CRM (email reminders, CSV exports) should
  carry as little personal information as possible — see the email
  section of `PRIVACY_AND_SECURITY.md`.
- Records are deactivated, completed or retired rather than deleted:
  history matters for this program.

Fictional demonstration data (`supabase/seed.sql`,
`supabase/local-test/`) is only for local development. Never load it into
the production project.

## The technology, briefly

- **Next.js + TypeScript** — the web application itself (what you see in
  your browser, and the logic behind it).
- **PostgreSQL, hosted by Supabase** — the database where all records are
  stored, plus Supabase's built-in sign-in system.
- **Tailwind CSS + shadcn/ui** — the visual design system, aimed at a
  warm, calm, simple, non-clinical feel that works well on a phone.

See `PLAN.md` for why these were chosen and how the pieces fit together.

## Project documents

- `PLAN.md` — the full build plan, stage by stage, in plain English.
- `DATABASE.md` — how information is organized (facilities, residents,
  contacts, interactions, tasks) and why.
- `PRIVACY_AND_SECURITY.md` — what protections are built in, and what
  additional professional review is still needed before using real
  resident data.

## Getting the app running on your own computer

1. Install [Node.js](https://nodejs.org) (version 20 or newer) if you
   don't already have it.
2. Get a copy of this repository onto your computer (e.g., `git clone`).
3. In a terminal, inside the project folder, run:
   ```
   npm install
   ```
   This downloads the various pieces the app depends on. You only need
   to do this once (and again any time those dependencies change).
4. Copy `.env.example` to a new file named `.env.local`, and fill in the
   Supabase connection details (see the comments inside that file for
   where to find them). **Use a development/test Supabase project for
   local work, not the production one** — the production database holds
   real resident information. `.env.local` is automatically excluded
   from Git, so your credentials never get committed.
5. Start the app:
   ```
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser.

Other useful commands:
- `npm run build` — builds an optimized production version (mainly used
  for deployment, or to double check nothing is broken).
- `npm run lint` — checks the code for common mistakes.

### Where it runs (production)

- **Database & sign-in:** Supabase project "Bikur Cholim CRM".
- **Web app:** Vercel team `bikur-cholim-cleveland`, project
  `bikur-cholim-crm`, served at `bikur-cholim-crm-eight.vercel.app`.
  See `LAUNCH_READINESS.md` for the two duplicate Vercel projects that
  should be retired.
- **Production branch:** Vercel deploys the lowercase **`main`** branch.
  (The repository also has a capital-M `Main` branch, which GitHub
  currently treats as its default; changes merged only there do **not**
  reach production. Open pull requests against `main`.)
- **Daily task reminders:** a Vercel Cron job (see `vercel.json`) calls
  `/api/cron/task-reminders` once a day. It only runs when `CRON_SECRET`,
  `RESEND_API_KEY` and `TASK_REMINDER_FROM_EMAIL` are set on the
  production project (see `.env.example`).

### Changing the database

Database changes are written as migration files in
`supabase/migrations/` and applied to the production project (in
filename order) once reviewed. Never "reset" the production database or
run seed files against it.

`supabase/checks/restricted_facility_access_check.sql` is a
self-rolling-back test of the facility access rules that is safe to run
against production after any security-related change.

The older `supabase/local-test/` harness predates several changes made
directly to the live project and is out of date; treat it as a starting
point for local experiments only.
