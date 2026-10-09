# Notes for Claude

The product owner is the department director, who is not technical.
Explain things in plain English, one topic at a time, and send
screenshots for anything visual.

## Merging pull requests (standing permission from the director, Sept 2026)

Claude may merge its own pull requests into `main` **without asking
first** when the change is a *small fix*, and must tell the director
afterwards what went live.

Small fix (merge yourself):
- bug fixes and corrections to wording or spelling
- small adjustments to something the director already approved
  (spacing, a wrong link, a mislabeled button)
- fixes the director or a reviewer asked for

Still ask first:
- new features, or anything that changes how the app looks
- anything that changes what is saved or who can see what (database
  migrations, access/RLS rules, privacy, what is sent to outside
  services)
- anything that deletes data

Before any merge: `npx tsc --noEmit`, `npm run lint` and `npm run build`
must pass, and the Vercel check on the pull request must be green.

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
- Food deliveries count once and are never copied to a colleague who was
  there; visits, calls and family entries are.
- A note started with "+ Log" on a resident's page is about that
  resident unless it names someone else ("visited her" = them), even
  when another resident shares the first name (Oct 8, 2026).
- One place for notes about a person (Oct 9, 2026): kosher food,
  holiday and visiting needs are saved as labelled "About them" notes
  ("Kosher food: only eats Glatt"), not the old resident boxes; anything
  sensitive still goes to Private.
