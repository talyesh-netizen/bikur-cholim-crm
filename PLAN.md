# Implementation Plan — Bikur Cholim Senior Living Support CRM

_Last updated: 2026-07-27_

This document explains, in plain English, how we are going to build this
application, in what order, and why. It is a living document — we will
update it as decisions change.

## 1. What we are building (Phase One)

A private, internal web application for the Senior Living Resident Support
Services department. Phase One is the foundation: a place to record
**facilities**, **residents**, **contacts**, **visits/interactions**, and
**follow-up tasks**, plus a **dashboard** that summarizes what's going on.

Nothing in Phase One is "advanced." No texting, no family-facing portal, no
maps, no automated reminders, no reporting engine. Those are explicitly
deferred to later phases so we can get a solid, trustworthy foundation in
place first.

## 2. Why this technology stack

You don't need to know how any of this works internally — just what each
piece is *for*:

| Piece | Plain-English purpose |
|---|---|
| **Next.js** | The web framework that builds both the pages you see and the behind-the-scenes logic that talks to the database. One project, one deployment, less to maintain. |
| **TypeScript** | A version of JavaScript that catches a category of bugs (e.g., "you forgot to fill in a resident's name field") before the app ever runs, instead of surprising a staff member later. |
| **PostgreSQL** | The actual database — the filing cabinet where every facility, resident, contact, visit, and task record lives. |
| **Supabase** | A hosted service that gives us a managed PostgreSQL database, plus built-in secure sign-in (authentication) and fine-grained "who can see what" rules (row-level security), without us having to build that machinery ourselves. |
| **Tailwind CSS** | A styling toolkit that lets us build a consistent, calm, warm visual design efficiently, and makes the phone/tablet layout work well without extra effort. |
| **shadcn/ui** | A set of pre-built, accessible interface components (buttons, forms, dialogs, tables) that we customize to match our warm/calm design direction, instead of building every button from scratch. |

This is a mainstream, well-supported combination. Any future developer —
staff, volunteer, or hired contractor — will be able to pick this up
without special or exotic knowledge.

## 3. How the pieces fit together (architecture, plain English)

```
Staff member's laptop or phone
        │  (uses a normal web browser)
        ▼
   Next.js application  ──────────────►  Supabase Auth
   (pages, forms, logic)                 (checks who you are,
        │                                 issues a secure session)
        ▼
   Supabase PostgreSQL database
   (facilities, residents, contacts,
    interactions, tasks — with rules
    baked in about who can read what)
```

- Staff sign in with an email/password (or a magic link) through Supabase
  Auth. Nobody gets into any data screen without signing in.
- Every request the app makes to the database is checked against
  **row-level security policies** — rules that live in the database itself,
  not just in the app's code. That means even if there were a bug in the
  app's screens, the database itself refuses to hand over data to someone
  who isn't allowed to see it. This is a much stronger form of protection
  than trusting the app alone.
- All secrets (database keys, etc.) live in environment variables — a
  separate, private configuration file that is never committed to Git —
  not typed into the source code.

## 4. Build order

We are building in the following order so that at every stage there is
something real to look at and test — not a black box that only becomes
useful at the very end.

**Stage 0 — Planning (this stage)**
- PLAN.md, README.md, database design, and privacy/security review
  (this document and its companions).

**Stage 1 — Project scaffolding**
- Create the Next.js + TypeScript + Tailwind + shadcn/ui project skeleton.
- Set up the warm, calm visual style (color palette, typography, spacing).
- Set up environment variable handling and `.gitignore` so secrets are
  never committed.

**Stage 2 — Database schema**
- Write the PostgreSQL table definitions (see `DATABASE.md`) as Supabase
  migration files.
- Add row-level security policies (the "who can see what" rules).
- Add fictional demonstration data (seed data) — no real residents, ever.

**Stage 3 — Authentication & app shell**
- Sign-in page, sign-out, session handling.
- The main navigation shell (the layout staff see on every page): a simple
  sidebar/bottom-nav that collapses sensibly on a phone.
- Basic roles: **Staff** and **Admin** (see Section 6).

**Stage 4 — Facilities**
- Facility directory (list + search/filter).
- Facility detail page (view/edit) including the "related records" panels
  (residents at this facility, staff contacts, past interactions, upcoming
  tasks).
- A small Admin-only settings screen for managing the list of geographic
  clusters (add, rename, retire) — so grouping facilities by region never
  requires a code change.
- Add/edit facility form.

**Stage 5 — Residents**
- Resident directory (list + search/filter).
- Resident detail page (view/edit).
- The "move to another facility" workflow that preserves history (see
  Section 5 below — this is one of the more important design decisions).
- Add/edit resident form.

**Stage 6 — Contacts**
- Contact directory (staff, family, rabbis, volunteers, etc.).
- Linking contacts to a facility and/or a resident.

**Stage 7 — Interaction log**
- Central log of visits, calls, programs, etc.
- Shows up on both the related facility page and the related resident page.
- "Log a visit" quick-add flow, since this will be the most common action.

**Stage 8 — Tasks & follow-up**
- Task list, add/edit, complete/cancel.
- Tasks tied to a facility, resident, and/or contact.

**Stage 9 — Dashboard**
- Once the underlying data exists, build the summary dashboard tying
  together facilities, residents, visits, programs, and open tasks.

**Stage 10 — Search & filters polish, phone testing, acceptance walkthrough**
- Go through the Phase One acceptance criteria (see Section 8) end to end.

We will commit to Git after each stage with a clear message, and after
each stage I will tell you (a) what's done, (b) how to test it yourself,
and (c) what's left.

## 5. Key design decision: moving a resident between facilities

You asked for a way to move a resident from one facility to another
**without losing history**. Here's the approach and why:

- A resident's interactions, tasks, and contact relationships are stored
  as their own records, each pointing to the resident — not stored "inside"
  the facility record. So a resident's history belongs to *them*, not to
  whichever facility they happened to be at when it was recorded.
- The resident record itself has a "current facility" field. When staff
  use the **"Move to another facility"** action, the app does two things
  in one step:
  1. Changes the resident's current facility to the new one.
  2. Automatically writes a transition record into the interaction log
     ("Resident transferred from Facility A to Facility B, on this date"),
     so the *change itself* becomes part of the visible history — not a
     silent edit.
- Because all past interactions and tasks still reference the resident
  (not the old facility), everything that happened at Facility A is still
  visible on the resident's page after the move. Nothing is deleted or
  overwritten.

## 6. Roles and access (Phase One version)

Phase One ships with two simple roles — enough structure to build on, not
so much that it's confusing:

- **Staff** — can view and edit facilities, residents, contacts,
  interactions, and tasks. This is the normal working role.
- **Admin** — everything Staff can do, plus managing user accounts (who
  has a login) and managing the geographic cluster list (add/rename/retire
  regions used to group facilities).

Every table has a "private notes" concept where relevant (e.g., a
resident's internal notes) and, from the start, we structure the database
so that a future "sensitive/restricted note" tier is a small addition, not
a redesign. See `PRIVACY_AND_SECURITY.md` for details and caveats.

## 7. Design philosophy: when to build "the robust version" vs. "the simple version"

You asked us to optimize for long-term scale (hundreds or thousands of
residents, multiple staff, volunteers, possibly more than one Bikur
Cholim organization someday) rather than always taking the fastest
shortcut. In practice, we're applying that as a rule of thumb, not a
blanket policy:

- **Where a "simple" design would obviously break down in normal, real
  use** — for example, a rabbi who serves several residents, or a
  facility region list that would otherwise require calling a developer
  to rename — we build the more robust version now. Two concrete
  examples already applied: contacts (family, rabbis, staff) can be
  linked to *multiple* residents or facilities, each with their own
  relationship type, instead of being limited to one; and geographic
  regions are a manageable list an Admin controls, not text typed
  differently by every staff member. See `DATABASE.md` for both.
- **Where a scalability concern is speculative** — for example, support
  for a *second* Bikur Cholim organization, which isn't a real
  requirement yet — we deliberately do *not* build for it today. Adding
  structure for a hypothetical future need means guessing at requirements
  (e.g., what should and shouldn't be shared between two organizations)
  instead of designing it properly when it's real. We'll revisit this
  specific question, carefully, if and when a second organization
  actually becomes real. This was a direct decision you confirmed.

The database itself (PostgreSQL) also scales to millions of rows without
architectural changes, so "hundreds or thousands of residents" is well
within what this foundation supports as-is — that part doesn't require
any special design work now.

## 8. What Phase One deliberately leaves out

To keep the foundation solid and avoid half-built features, Phase One does
**not** include: SMS/text messaging, a family-facing portal, maps, volunteer
reminder automation, calendar sync, automated report generation, or a
knowledge base. These are noted as Phase Two+ ideas in `README.md`.

## 9. Phase One acceptance criteria (how we'll know we're done)

Directly from your requirements — you should be able to:

1. Sign in securely.
2. View the dashboard.
3. Add and edit a facility.
4. Add and edit a resident.
5. Move a resident to another facility while preserving history.
6. Add facility staff and family contacts.
7. Record a resident visit or other interaction.
8. Create and complete follow-up tasks.
9. Search and filter the records.
10. Use the core application comfortably from a phone.

We will walk through this list together once Stage 10 is complete.

## 10. Open decisions I'm making by default (flag if you'd prefer differently)

- **Hosting**: we'll build so the app can be deployed on Vercel (a common
  Next.js hosting provider) with Supabase as the database, but Phase One
  work happens locally/in this environment first — we are not deploying
  anything publicly yet.
- **Sign-in method**: email + password to start, since it's the simplest
  for non-technical staff to understand. Supabase makes it easy to add
  "magic link" (a sign-in email with a click-through link) later if you'd
  prefer no passwords at all.
- **Demo data**: entirely fictional facilities modeled loosely on the
  *types* of places you described (nursing home, assisted living, etc.)
  in the Northeast Ohio area conceptually, but with invented names,
  invented people, and invented details throughout.

## 11. Roadmap decisions log

Decisions that affect future direction but aren't Phase One work
themselves, recorded here so they don't get re-litigated or lost —
useful background if a separate roadmap document is being maintained
elsewhere too.

### Department / multi-organization support — deferred (2026-07-27)

**Decision:** Phase One remains single-department (Bikur Cholim of
Cleveland's Senior Living Resident Support Services team). No
`department_id`-style fields or multi-organization functionality are
added to the core database tables at this time.

**Reasoning:** designing real multi-department data-sharing/permission
rules without a real second department to design against means
guessing at requirements (should residents be shared across
departments? Staff? Facilities? Fully separate, or partially?). That
guess would likely be wrong and costly to unwind. Deferring until
there's a concrete second use case lets that design be done properly
instead.

**What this means in practice:**
- No department filters, permissions, screens, or workflows are built
  now, since there's nothing real for them to do yet.
- The current department's name ("Bikur Cholim of Cleveland") is kept
  out of reusable database logic entirely (nothing in
  `supabase/migrations/` references it), and centralized to a single
  place in the application code (`src/lib/config.ts`) rather than
  scattered across components — so that if/when this changes, it's a
  small, contained edit rather than a search-and-replace.
- This is a **future roadmap item**, not a rejected idea: revisit with
  real requirements once a second department or organization is
  actually being planned.
