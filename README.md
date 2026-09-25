# Bikur Cholim of Cleveland — Senior Living Resident Support Services CRM

An internal web application for the Senior Living Resident Support Services
department. It helps staff keep track of facilities, Jewish residents in
those facilities, family and staff contacts, visits and other interactions,
and follow-up tasks — in one place, instead of spreadsheets and memory.

This is **not** a public website. It is only for department staff, and it
requires signing in.

> **Phase One, in progress.** This application is being built in stages.
> See `PLAN.md` for the full build plan and `DATABASE.md` for how
> information is organized. See `PRIVACY_AND_SECURITY.md` before ever
> entering real resident information.

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

On purpose, Phase One does **not** include text messaging, a portal for
families to log in themselves, maps, automatic volunteer reminders,
calendar syncing, automated reports, or a knowledge base. Those are
reasonable future additions, but they are not part of this first
foundation. See `PLAN.md` for the reasoning.

## Who can use it

Everyone who uses this application must sign in with an account created
for them. There are two roles to start:

- **Staff** — the normal working role. Can view and edit facilities,
  residents, contacts, interactions, and tasks.
- **Admin** — everything Staff can do, plus the ability to manage which
  staff have accounts.

There is no public or family-facing access in Phase One.

## Important: no real resident information yet

This application currently contains **only fictional, made-up demonstration
data** — invented facility names, invented residents, invented contacts.
Do not enter real residents' names or details until the steps described in
`PRIVACY_AND_SECURITY.md` (a professional security and compliance review)
have actually happened. This codebase gives you a strong *foundation* for
handling sensitive information responsibly, but a foundation is not the
same as a completed compliance review.

## The technology, briefly

- **Next.js + TypeScript** — the web application itself (what you see in
  your browser, and the logic behind it).
- **PostgreSQL, hosted by Supabase** — the database where all records are
  stored, plus Supabase's built-in sign-in system.
- **Tailwind CSS + shadcn/ui** — the visual design system, aimed at a
  warm, calm, simple, non-clinical feel that works well on a phone.

See `PLAN.md` for why these were chosen and how the pieces fit together.

## Installing the app on a phone

The CRM can be added to a phone's home screen and opened full-screen,
like a regular app. There is nothing to download from an app store.

**iPhone (must use Safari):**
1. Open the CRM's web address in **Safari** and sign in.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.
4. Open it from the new "Resident Support" icon from now on.

**Android (Chrome):**
1. Open the CRM's web address in **Chrome** and sign in.
2. Tap the **⋮** menu in the top-right corner.
3. Tap **Add to Home screen** (on some phones it says **Install app**), then **Install**.
4. Open it from the new "Resident Support" icon. Long-pressing the icon
   offers shortcuts to "Log a visit" and "Tasks".

## Production web address (one-time setup)

The app should be used from one official address (for example
`https://crm.bikurcholimcleveland.org`). In Vercel, under
**Settings → Environment Variables**, for the **Production** environment:

- `NEXT_PUBLIC_SITE_URL` — the official address, including `https://`.
  Used for links in password-reset and task-reminder emails.
- `REDIRECT_TO_CANONICAL_DOMAIN` — optional; set to `true` only after the
  official address loads correctly, to send anyone who opens the
  `*.vercel.app` address over to the official one.

In Supabase, under **Authentication → URL Configuration**, set the
**Site URL** to the same official address and add `https://<that address>/`
to **Redirect URLs** — otherwise password-reset links won't work.

## Task emails (one-time setup)

When someone assigns you a task, you get an email right away. Each morning
(about 8am Cleveland time, Sunday–Friday, none on Shabbos) everyone also gets
one summary email of their tasks that are due today or overdue. No
email is sent if nothing is due.

To turn this on, add these in Vercel under **Settings → Environment
Variables** (Production), then redeploy:

- `RESEND_API_KEY` — from a free account at resend.com (**API Keys**).
- `TASK_REMINDER_FROM_EMAIL` — e.g. `Bikur Cholim CRM <crm@bikurcholimcleveland.org>`,
  after verifying `bikurcholimcleveland.org` on Resend's **Domains** page.
  Until then, emails can only reach the Resend account owner's address.
- `CRON_SECRET` — any long random password; protects the morning email.
- `SUPABASE_SERVICE_ROLE_KEY` — must also be set (the morning email uses it).

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
   where to find them — this step isn't needed yet if you're just looking
   at the visual scaffold, since sign-in and the database aren't wired up
   yet). `.env.local` is automatically excluded from Git, so your
   credentials never get committed.
5. Start the app:
   ```
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser.

Other useful commands:
- `npm run build` — builds an optimized production version (mainly used
  for deployment, or to double check nothing is broken).
- `npm run lint` — checks the code for common mistakes.

### Current status

- **Stage 1 (done):** the visual scaffold — color palette, fonts, and a
  handful of reusable interface pieces (buttons, cards, inputs).
- **Stage 2 (done):** the real database structure exists as migration
  files in `supabase/migrations/`, with security rules tested and
  fictional demo data ready to load. See `DATABASE.md`.
- **Not yet connected:** the running app doesn't talk to a database yet
  — there is no real Supabase project behind it, so sign-in and every
  data screen are still ahead. That's next, per `PLAN.md`.

### Setting up the database (once a Supabase project exists)

1. Create a free Supabase project at [supabase.com](https://supabase.com).
2. Fill in `.env.local` with that project's URL, anon key, and service
   role key (see `.env.example` for where to find each one).
3. Apply the migrations in `supabase/migrations/` to that project, in
   filename order (e.g., via the Supabase CLI's `supabase db push`, or
   by pasting each file into the Supabase SQL Editor in order).
4. Run `npm run seed:users` to create three fictional demo staff
   accounts, then run the contents of `supabase/seed.sql` against the
   project to load the rest of the fictional demo data.

To instead verify the database design itself on this machine, without a
real Supabase project, see `supabase/local-test/README.md`.
