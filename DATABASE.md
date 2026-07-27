# Database Structure

_Last updated: 2026-07-27 (implemented and tested)_

**Status: built and tested.** Everything described below now exists as
real SQL migration files in `supabase/migrations/`, and has been tested
against a local PostgreSQL server (standing in for Supabase, since this
environment can't run Supabase's full stack) — including proving the
security rules actually block/allow access correctly, not just that the
tables exist. See `supabase/local-test/README.md` for how that was
verified, and `supabase/seed.sql` / `scripts/seed-demo-users.ts` for the
fictional demo data that will load into the real Supabase project once
one exists.

This document explains how information is organized in the database, in
plain English. Think of each **table** as its own spreadsheet tab, and
each row as one record (one facility, one resident, one visit, etc.).
"Linking" one table to another just means one spreadsheet has a column
that says "this row belongs to row #47 on that other tab."

## Decisions confirmed so far

- **A resident can have multiple family contacts**, each with their own
  relationship (son, daughter, spouse, sibling, grandchild, power of
  attorney, friend, clergy, other), their own phone/email/address/notes,
  and one may be flagged as the **Primary Contact**. Details below.
- **Geographic clusters are a managed list**, not free text and not fixed
  in code — an Admin can add, rename, or retire a cluster without a code
  change. Details below.
- **Single organization for now.** Phase One is scoped to Bikur Cholim of
  Cleveland only. We are deliberately *not* adding "which organization"
  fields throughout the database in anticipation of a hypothetical future
  second organization — if that ever becomes real, it deserves its own
  careful design conversation at that time (access rules between
  organizations are a real decision, not just a database column). Building
  it in now, before there's a second organization to design against, would
  mean guessing.
- **General design philosophy going forward:** where there's a real,
  foreseeable reason a "simple" version would break down at scale (e.g.,
  "a rabbi can only be linked to one resident" clearly doesn't hold up),
  we build the more robust version now, as long as it doesn't make the
  app harder to use day-to-day. Where a scalability concern is
  speculative rather than foreseeable, we keep things simple and revisit
  later with real requirements in hand.

## Design choices explained up front

- **Statuses (like "Active" or "Follow up needed") are stored as plain
  text with a restricted list of allowed values**, rather than a rigid
  database-level enumeration. In practice this means: the list of allowed
  statuses is enforced, but if the department later wants to add a new
  status (e.g., a new engagement status), that is a small, safe change —
  not a disruptive database rebuild.
- **Every table has `created_at` and `updated_at` timestamps**, and we
  record *which staff member* created or last changed a record. This is
  what "audit-friendly" means in practice: if a question ever comes up
  about who changed what and when, the answer is already in the data —
  we're not bolting that on later.
- **Nothing is ever hard-deleted by staff through the app.** Records can
  be marked inactive/cancelled, but the underlying history stays intact.
  This protects against accidental data loss and keeps history reliable.
- IDs are invisible to staff — nobody will need to know or type "resident
  #47." That's internal bookkeeping the app handles for you.

## Tables

### `geographic_clusters` — admin-managed list

One row per named region the department uses to group facilities (e.g.,
"East Side," "West Side," "Akron area"). This exists as its own table,
not as free text typed on each facility, specifically so that:

- Every facility using "East Side" is guaranteed to be spelled and
  grouped consistently (no "East Side" vs. "east side" vs. "Eastside"
  drift, which would quietly break any future route planning, reporting,
  or volunteer-assignment feature built on top of it).
- An **Admin** can add a new cluster, rename an existing one (the name
  updates everywhere it's used automatically, since every facility just
  points to this row), or **retire** one that's no longer used — all from
  a settings screen, with no code change or developer involvement.
- Retiring a cluster doesn't delete it or break history — it just hides
  it from the dropdown when adding *new* facilities, while facilities
  already assigned to it keep working normally.

| Field | Purpose |
|---|---|
| Name | e.g., "East Side" |
| Description | Optional — what this cluster covers, for staff clarity |
| Display order | Controls the order clusters appear in dropdowns |
| Active | Whether this cluster is available for new assignments (retiring sets this to false rather than deleting) |
| Created at / Updated at | Standard audit timestamps |

Each facility belongs to exactly **one** cluster (a facility can't be in
two regions at once), and a cluster can contain any number of facilities.

A minimal admin screen to manage this list (add / rename / retire) is
part of Phase One, since without it the "no code change needed" goal
wouldn't actually be true on day one.

### `profiles` — staff accounts

One row per staff member who can sign in. Supabase's authentication system
handles the actual sign-in (password, email verification, sessions); this
table stores the extra information the app needs about that person.

| Field | Purpose |
|---|---|
| Full name | Displayed throughout the app (e.g., "Visit logged by Talya") |
| Email | Matches their sign-in account |
| Role | `staff` or `admin` (see `PRIVACY_AND_SECURITY.md`) |
| Active | Whether this person currently has access |
| Created at | When the account was set up |

### `facilities`

One row per facility (nursing home, assisted living, etc.).

| Field | Purpose |
|---|---|
| Name | e.g., "Maplewood Care Center" |
| Facility type | Nursing home / Assisted living / Rehabilitation center / Memory care / Independent living / Senior apartment building / Hospital / Other |
| Address, City, ZIP | Location |
| Main phone | Facility's front desk / main line |
| Website | Optional link |
| Parent healthcare group | e.g., a hospital system or ownership group the facility belongs to, if any |
| Geographic cluster | Link to `geographic_clusters` (see below) — each facility belongs to exactly one cluster |
| Approx. Jewish resident count | A number, since exact counts often aren't knowable |
| Jewish residents currently known | Yes/No — useful even before any individual resident is added |
| Engagement status | Not contacted / Initial contact made / Staff relationship developing / Active facility / Recurring visits / Recurring programming / No Jewish residents currently known / Follow up needed |
| Visit priority | e.g., High / Medium / Low — how urgently this facility needs attention |
| Last visit date | Auto-calculated from the interaction log (see below) so staff never has to update it by hand and it can't drift out of sync |
| Recommended visit frequency | e.g., "Weekly," "Monthly," "Quarterly" |
| Kosher food availability | e.g., Yes / No / Some options / Unknown |
| Notes | General free-text notes |
| Active | Whether this facility is currently tracked (inactive facilities are hidden from normal lists but not deleted) |

**Why "last visit date" is calculated, not typed in:** if staff had to
manually update this every time, it would quietly go stale. Instead, the
app looks at the interaction log and always shows the true most-recent
visit. Same logic applies to residents.

### `residents`

One row per resident. Always linked to their **current** facility.

| Field | Purpose |
|---|---|
| First name, Last name, Preferred name | Identity |
| Current facility | Link to `facilities` |
| Room number | |
| Phone number | Resident's own phone, if any |
| Family contacts | Not a field on this table — see `resident_contacts` below. A resident can have any number of family contacts, one of which can be flagged Primary. |
| Rabbi / synagogue connection | Free text, or link to a `contacts` record via `resident_contacts` if that rabbi is already in the system |
| Jewish interests / background | Free text |
| Kosher food needs | Free text or short selection |
| Holiday support needs | Free text |
| Visitation needs | Free text (e.g., mobility, hearing, preferred time of day) |
| Preferred visit frequency | e.g., "Weekly" |
| Last visit date | Auto-calculated from the interaction log |
| Next follow-up date | Auto-calculated from open tasks, or manually set |
| Status | Active / Temporarily hospitalized / Moved to another facility / Returned home / Deceased / Unable to reach / No longer receiving services |
| Private internal notes | See `PRIVACY_AND_SECURITY.md` — treated as more sensitive than the fields above |

### `resident_facility_history`

This is the table that makes "move a resident without losing history"
work. Every time a resident is at a facility, that's one row here: which
resident, which facility, the date they started there, and (once they
leave) the date that ended.

When staff use the app's **"Move to another facility"** action:
1. The current history row gets an end date (today).
2. A new history row is created for the new facility (starting today).
3. The resident's "current facility" is updated.
4. A record is automatically added to the interaction log noting the
   transfer, so it's visible in the resident's timeline, not just in a
   background table.

This means a resident's page can always show "Currently at Facility B,
previously at Facility A from March to July," and nothing about their
visits, tasks, or contacts at Facility A disappears.

### `contacts`

One row per **person**, kept separate from *how that person relates to a
resident or facility* (that relationship lives in the two connector
tables below). This split matters in practice: the same rabbi might be
the spiritual contact for three different residents, and a facility's
Activities Director is a staff contact who isn't tied to any one
resident at all. Storing "who someone is" separately from "who they're
connected to and how" is what makes both of those normal, everyday
situations easy to represent correctly.

| Field | Purpose |
|---|---|
| Name | |
| Organization | e.g., a facility name, a synagogue, a nonprofit (free text — this is about where they work/volunteer, separate from any specific facility link) |
| Contact type | Facility staff / Family member / Rabbi / Synagogue contact / Community partner / Volunteer / Other referral source |
| Phone, Email | |
| Address | Street, city, state, ZIP — optional, most useful for family contacts (e.g., holiday cards) |
| Preferred communication method | e.g., Phone / Email / Text (recorded, even though texting isn't built yet) |
| Notes | General notes about this person, not specific to one resident relationship |
| Active | Whether this contact is current (e.g., staff member who has left is marked inactive, not deleted) |

### `resident_contacts` — how a contact relates to a specific resident

One row per resident–contact relationship. This is what lets a single
person (say, Rabbi Cohen) be linked to several residents, and lets a
resident have several family contacts, each with their own relationship
type.

| Field | Purpose |
|---|---|
| Resident | Link to `residents` |
| Contact | Link to `contacts` |
| Relationship to resident | e.g., Son / Daughter / Spouse / Sibling / Grandchild / Power of attorney / Friend / Rabbi / Other — describes this specific relationship |
| Primary contact | Yes/No — at most one contact per resident can be marked Primary (enforced by the database itself, not just the app, so this can never quietly end up with two "primary" contacts by mistake) |
| Relationship notes | Notes specific to this relationship (e.g., "handles medical decisions," "prefers not to be called after 6pm") — separate from the general notes on the person themselves |

A resident's page shows all of their linked contacts, with the Primary
Contact highlighted for quick reference, exactly as you described.

### `facility_contacts` — how a contact relates to a specific facility

Same idea, for facility staff: one row per facility–contact relationship,
so a regional director who oversees multiple facilities, for example,
can be correctly linked to all of them rather than forced into just one.

| Field | Purpose |
|---|---|
| Facility | Link to `facilities` |
| Contact | Link to `contacts` |
| Role at facility | e.g., "Activities Director," "Social Worker," "Front Desk" |
| Primary contact | Yes/No — the main person to reach out to at that facility |

### `interactions` — the central log

One row per visit, call, program, or other logged activity.

| Field | Purpose |
|---|---|
| Date and time | |
| Interaction type | Resident visit / Resident phone call / Family communication / Facility staff communication / Facility discovery visit / Volunteer visit / Program / Kosher food coordination / Hospital related communication / Referral / Email / Other |
| Facility | Link to `facilities` |
| Resident | Optional link to `residents` (some interactions, like a facility discovery visit, aren't about one resident) |
| Contact | Optional link to `contacts` |
| Staff member | Who completed it (link to `profiles`) |
| Volunteers involved | Zero or more volunteers (linked via a small connector table, since one visit can involve several volunteers) |
| Notes | |
| Outcome | Short free-text summary of what happened |
| Follow-up needed | Yes/No |
| Follow-up date | If follow-up is needed |

This one table is what powers both the facility page's "past interactions"
list and the resident page's "past interactions" list — it's the same
underlying record, just filtered and displayed in each place.

### `tasks`

One row per follow-up item.

| Field | Purpose |
|---|---|
| Title | |
| Description | |
| Due date | |
| Priority | e.g., High / Medium / Low |
| Status | Open / In progress / Waiting / Completed / Cancelled |
| Assigned staff member | Link to `profiles` |
| Related facility, resident, contact | All optional links |
| Task category | Visit / Phone call / Family follow up / Facility follow up / Volunteer coordination / Program planning / Kosher food / Referral / Hospital follow up / Resident transition / Other |
| Completion notes | Filled in when marked completed |

## How things connect (plain-English map)

```
geographic_clusters ──< facilities (a cluster has many facilities;
                          each facility belongs to exactly one cluster)

facilities ──< residents (a facility has many residents)
facilities ──< interactions
facilities ──< tasks
facilities ──< facility_contacts >── contacts (many-to-many: a facility
                has many staff contacts; a person like a regional
                director can be linked to several facilities)

residents  ──< resident_facility_history (a resident's full facility timeline)
residents  ──< interactions
residents  ──< tasks
residents  ──< resident_contacts >── contacts (many-to-many: a resident
                has many family/rabbi/other contacts; a person like a
                rabbi can be linked to several residents; each link
                carries its own relationship type and an optional
                "Primary Contact" flag)

interactions ──< interaction_volunteers >── contacts (many-to-many: a
                  visit can involve several volunteers; a volunteer can be
                  part of several visits)
```

## Demonstration data plan

Once this structure is approved, Phase One will ship with a handful of
entirely fictional facilities (invented names, loosely styled after the
*types* of places — nursing home, assisted living, rehab — found in
Northeast Ohio, but not real places), a small number of fictional
residents with invented names and invented details, a few fictional
contacts, a handful of logged interactions, and a few open and completed
tasks — enough to make every screen meaningful to look at immediately.

## Remaining open question

Anything above that doesn't match how you'd actually describe a
resident's status or a facility's engagement in real life? Everything
else (family contacts, geographic clusters, single-organization scope)
has been confirmed and is reflected above.
