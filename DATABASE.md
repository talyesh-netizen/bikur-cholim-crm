# Database Structure (Proposed)

_Last updated: 2026-07-27_

This document explains how information will be organized in the database,
in plain English, before any code is written. Think of each **table** as
its own spreadsheet tab, and each row as one record (one facility, one
resident, one visit, etc.). "Linking" one table to another just means one
spreadsheet has a column that says "this row belongs to row #47 on that
other tab."

This is a **proposal** — nothing is built yet. Let me know if anything
here doesn't match how the department actually thinks about its work
before we build it.

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
| Geographic cluster | A department-defined grouping (e.g., "East Side," "West Side," "Akron area") used for planning visit routes |
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
| Family contact | Link to a `contacts` record (see below) rather than typing family info twice |
| Rabbi / synagogue connection | Free text, or link to a `contacts` record if that rabbi is already in the system |
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

One row per person who isn't a resident: facility staff, family members,
rabbis, synagogue contacts, community partners, volunteers, or other
referral sources.

| Field | Purpose |
|---|---|
| Name | |
| Organization | e.g., a facility name, a synagogue, a nonprofit |
| Role | e.g., "Activities Director," "Daughter," "Volunteer" |
| Phone, Email | |
| Contact type | Facility staff / Family member / Rabbi / Synagogue contact / Community partner / Volunteer / Other referral source |
| Related facility | Optional link to `facilities` |
| Related resident | Optional link to `residents` |
| Preferred communication method | e.g., Phone / Email / Text (recorded, even though texting isn't built yet) |
| Notes | |

A contact can be linked to a facility, a resident, both, or neither
(e.g., a community partner not tied to one specific place). A person who
supports several residents (a rabbi, for example) can currently have one
primary related resident recorded; supporting a contact being linked to
*many* residents cleanly is a reasonable Phase Two refinement if this
department needs it — flagging it now rather than over-building it today.

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
facilities ──< residents (a facility has many residents)
facilities ──< contacts (a facility has many staff contacts)
facilities ──< interactions
facilities ──< tasks

residents  ──< resident_facility_history (a resident's full facility timeline)
residents  ──< interactions
residents  ──< tasks
residents  ──< contacts (family, etc. linked to a specific resident)

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

## Questions for you before we build this

1. Does "Family contact" on a resident need to support **multiple** family
   members (e.g., two adult children), or is one primary family contact
   enough for Phase One?
2. Is "Geographic cluster" something the department already has a fixed
   list for (e.g., specific named regions), or should it start as free
   text?
3. Anything above that doesn't match how you'd actually describe a
   resident's status or a facility's engagement in real life?
