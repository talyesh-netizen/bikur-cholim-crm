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
- Already logged that day (Oct 9, 2026): an entry with the same resident,
  kind and day as one already saved is flagged on the check screen,
  "Is this a second visit?" Yes saves it as its own visit; No unticks
  it. Never dropped or added without the person answering.
