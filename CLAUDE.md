# Notes for Claude

The product owner is the department director, who is not technical.
Explain things in plain English, one topic at a time, and send
screenshots for anything visual.

## Merging and deploying (director, Oct 12, 2026)

Never merge or deploy CRM changes without explicit approval from the
director following ChatGPT QA review. This supersedes the earlier
(Sept 2026) permission to merge small fixes without asking.

Before any merge: `npx tsc --noEmit`, `npm run lint` and `npm run build`
must pass, and the Vercel check on the pull request must be green.

## Decision handoff to ChatGPT (director, Oct 12, 2026)

ChatGPT reviews product decisions alongside the director. Whenever a
report needs genuine product approval (how something looks or works
for staff, what is saved, who can see what), end it with a short,
ready-to-paste question for ChatGPT:
- the background in plain words (ChatGPT can't see the code),
- the options, each with its upside and downside,
- Claude's recommendation,
- exactly what answer is needed back ("Reply A or B and why").

Routine engineering choices (naming, file layout, how a fix is coded)
don't get one; just make the call and mention it.

## Other context

- Live site deploys from lowercase `main` (see `LAUNCH_READINESS.md`).
- Real resident data is in production; see `PRIVACY_AND_SECURITY.md`
  before sending any data anywhere new.

## Quick Log rules (keep updating)

The director asked (Oct 7, 2026) that Quick Log's rules keep being
updated as field use shows misreadings. When they report one:
1. Add or adjust the rule in `src/lib/assistant/prompt.ts` (plain
   words, with the director's own example).
2. Add a matching scenario to `scripts/quick-log-scenarios.ts`.
3. Note the decision below.

Decisions so far:
- Only log an interaction when the note says one happened; only make a
  task for a stated future action (task-only and update-only notes are
  fine).
- Past visits use the day they happened; unclear dates are flagged for
  the person to confirm, never guessed.
- No separate "facility visit" on top of resident visits that day.
- A family member who was there and spoken with gets their own family
  entry (they are the one supported); one only mentioned gets none.
- "Family" support needs no sub-type; the kind of support is optional.
- Staff meetings with volunteers (recruiting, onboarding, check-ins) are
  "Meeting with a volunteer" entries, separate from volunteer visits.
- Food deliveries count once and are never credited to a colleague who
  was there; visits, calls and family entries are. Since Oct 16, 2026
  (decision B1) a colleague is a team member on the same single entry,
  not a copy of it, so the visit counts once and both are credited.
- A note started with "+ Log" on a resident's page is about that
  resident unless it names someone else ("visited her" = them), even
  when another resident shares the first name (Oct 8, 2026).
- One place for notes about a person (Oct 9, 2026): kosher food,
  holiday and visiting needs are saved as labelled "About them" notes
  ("Kosher food: only eats Glatt"), not the old resident boxes; anything
  sensitive still goes to Private.
- A note keeps the day it was started (Oct 11, 2026): a Friday note
  read on Saturday is dated Friday, never "now". On site there is a
  "Visit date" line; a note kept from before start times were recorded
  asks for the day before it can be read. Visit/Talked notes keep the
  time they were started; only the day is shown and changeable before
  saving (Oct 19, 2026, below).
- Dates, not times (Oct 19, 2026, decision B1): logging asks for the
  day only and lists show the day only. No time is made up: a past day
  is saved at noon, today at the moment of saving, and an edit that
  keeps the day keeps the time already saved. When it was typed in is
  still recorded (created_at).
- In person (Oct 19, 2026, decision B; widened Oct 21): a staff
  conversation saved from the on-site notes box is marked in person, so
  it counts as a facility visit-day; elsewhere Quick Log leaves it
  unmarked (the person picks In person at facility / In person
  elsewhere / Phone / Email / Video when fixing it). Visits, programs and deliveries are in person and phone
  calls by phone, without asking. Calls, email and video never count.
- Outside professionals (Oct 19, 2026): a conversation with someone who
  isn't staff at a facility we serve (a hospice or agency contact, e.g.
  Tina at Affinity Care) is "Other", no facility needed, never a staff
  conversation, so it isn't counted as facility staff support.
- Already logged that day (Oct 9, 2026): an entry with the same resident,
  kind and day as one already saved is flagged on the check screen,
  "Is this a second visit?" Yes saves it as its own visit; No unticks
  it. Never dropped or added without the person answering.

## Reporting definitions (director, Oct 21, 2026)

- Facility numbers, each facility once per Cleveland day: staff visits
  (our staff there in person), volunteer-only visits, total facility
  presence (either); plus facilities visited and facilities engaged
  (any contact, calls included). Kept apart on every screen. Entries
  with no recorded method are never assumed in person, except kinds
  that can only happen in person. Off-site entries (no facility) never
  count as visits.
- Staff interactions: each distinct meeting or conversation once,
  however many staff were in it (four staff = one meeting, four
  people); staff people counted separately. A first visit to a new
  facility always counts as a facility visit, and as a staff meeting
  only when someone was actually met.
- Mistakes are voided (reason required, restorable, in the change
  history), never deleted, and never counted. Historical entries are
  only ever combined or voided by a person's answer, one at a time.
- A resident is required only on resident entries (a visit or a phone
  call with a resident), not on facility visits, staff conversations,
  programs, or group visits counted with "Residents reached".
- Reports can cover any month, quarter, year or range of days.
- Where it happened (Oct 21, 2026, Option B): "How?" offers In person
  at facility / In person elsewhere / Phone / Email / Video on every
  kind that asks it. Only "In person at facility" counts as a visit;
  "elsewhere" (a shiva house, a hospital, a school) keeps the entry's
  resident and facility. "At facility" needs a facility, so without one
  it is saved as elsewhere. Older entries stay "not recorded".
- Facility Visit entry stays (Oct 21, 2026, Option A): for a visit
  where no resident interaction or staff meeting happened. A Facility
  Visit plus resident visits there the same day is still one facility
  visit. Facility visits, resident interactions and staff meetings are
  counted separately; a Facility Visit is a staff meeting only when
  staff were actually met.

## October 27 cleanup decisions (director, Oct 27, 2026)

These replace any earlier rule above that says otherwise.

- One record per person: each person spoken with gets their own
  interaction record (staff, family, partners, volunteers met). Picking
  several people in one form saves a separate record for each, with the
  same day, place, notes and team members, all-or-nothing like resident
  visits. "Others who were there (not counted)" is not asked on these.
  Programs stay one group activity.
- Staff interactions count each person spoken with once per record; there
  is no separate "meetings" number any more, and Data Quality no longer
  suggests combining a meeting saved once per person ("Same meeting").
- Staff visits: each staff member (lead or team) once per facility per
  Cleveland day, shown beside facility visit-days (each facility once a
  day), which stay. Repeat trips on the same day aren't counted
  separately yet.
- Volunteer-only visits give no staff credit (not a staff visit and not
  in the staff activity list). Meetings and conversations with
  volunteers are still recorded and credited.
- Partner conversations are counted on their own line, never as facility
  staff support or a facility visit. A partner is decided by how the
  person is already filed: Community partner, Rabbi or Shul contact
  (schools, shuls, Jewish organizations, hospices, agencies and other
  healthcare organizations). Facility staff stay facility staff, even
  when their facility belongs to a healthcare group. Past reports use
  this classification; saved records are not changed.
- Programs: one entry, with students and volunteers asked separately
  (plus residents reached). Older programs' single number is shown as
  "Not split".
- Food: one number, people who received food. Item counts already saved
  stay on file but are no longer asked or reported.
- Family: needs no resident or facility; no separate care navigation
  kind (older care navigation entries count as family).
- Facility visit is offered under "More types" on the log form.
- Facility staff: addresses are not asked or shown. Role is a list:
  Executive Director, Administrator (LNHA), Activities Director, Life
  Enrichment Director, Social Worker, Chaplain, Assisted Living
  Director, Director of Nursing, Business Office Manager, Sales &
  Marketing, Receptionist, Other (type a title). Titles already typed
  in are kept exactly as they are.
- "+ Log" from anyone's page (resident, family member, staff, volunteer,
  partner) starts with that person attached, whatever kind is picked.
- Navigation stays as it is. Expanded On-site Mode, major redesigns and
  GitHub refactoring wait.
- Stories (Oct 27, 2026, option C): a simple free-form log, kept apart
  from interactions so it never counts in any report. Only the text is
  needed; a resident and/or facility can be linked then, later or never.
  The date is set automatically. Under More (in the sidebar on a
  computer) and on linked resident and facility pages. Seen by active
  staff who can see the linked resident and facility; an unlinked story
  is hidden from facility-limited accounts unless they wrote it. Edits
  are kept in the change history; stories can't be deleted from the app.
