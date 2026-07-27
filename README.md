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

## Project documents

- `PLAN.md` — the full build plan, stage by stage, in plain English.
- `DATABASE.md` — how information is organized (facilities, residents,
  contacts, interactions, tasks) and why.
- `PRIVACY_AND_SECURITY.md` — what protections are built in, and what
  additional professional review is still needed before using real
  resident data.

## Getting the app running on your own computer (for later, once code exists)

This section will be filled in once Stage 1 (project scaffolding) is
complete. In short, you will need:

1. Node.js installed on your computer.
2. A free or paid Supabase project (this is where the database lives).
3. A copy of this repository, with a `.env.local` file containing your
   Supabase connection details (never committed to Git).

Detailed, copy-pasteable steps will be added here as soon as there's a
running application to start.
