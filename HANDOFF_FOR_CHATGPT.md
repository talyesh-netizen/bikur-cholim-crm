# Bikur Cholim CRM: quick handoff (Oct 7, 2026)

**Who I am:** Director of the senior care department (Bikur Cholim Cleveland). I'm not technical, so please explain things in plain English, one step at a time.

**What the CRM is:** A web app we built to track our work with residents, families, facility staff and volunteers across dozens of senior care facilities. That work includes visits, calls, family support, kosher food deliveries, holiday programs and medical referrals.

- **Built with:** Next.js (website), Supabase (database and logins), and Vercel (hosting).
- **Code:** GitHub repo `talyesh-netizen/bikur-cholim-crm`.
- **How updates go live:** the live site updates automatically when changes go into the `main` branch.
- **Privacy:** real resident data is in the database. Don't paste resident details, passwords or keys into chats. Read `PRIVACY_AND_SECURITY.md` in the repo first.

## Recently finished (all live)

- **Quick Log:** I type or speak a note, and the AI turns it into entries (visits, calls, family support, tasks) for me to review.
  - It asks for the place first, and each card has an Edit button.
  - It now runs on a lighter setting so it's faster.
  - Its rules are written in `src/lib/assistant/prompt.ts`. The decisions behind them are listed in `CLAUDE.md`.
- **New interaction type:** "Meeting with a volunteer", for recruiting, onboarding and check-ins.
- **Food deliveries** count once and are never credited to a colleague who came along.
- **Tasks:** there's an "Add a task" button on each resident's page. New residents get an automatic check-in task one week out.
- **Change password:** users can change their own password in Settings.
- **Spreadsheet cleanup:** the import was checked against the old tracking spreadsheet. Holidays were tagged and missing people added.
- **Impact page (new today):**
  - A "Growth" section with new residents, facilities and volunteers per quarter.
  - A "Family connection over time" chart (currently 21%, 30 of 140 residents).
  - No goal line for now. One can be added later in `src/lib/impact-goals.ts`.

## Open items

- **On my list in the CRM:**
  - Find out whose family 5 unlinked contacts belong to (due Oct 21).
  - Confirm one resident's move to The Ashton (due Oct 21).
  - New-resident check-in (due Oct 14).
- **Coming next:** I have "a few things to add on the backend" that I haven't listed yet.
- **Speed check:** see how the faster Quick Log feels in daily use.
- **Quick Log misreadings:** whenever I report one, add a rule to `prompt.ts`, add a test example to `scripts/quick-log-scenarios.ts`, and log the decision in `CLAUDE.md`.

## House rules for changes

- **Before anything goes live:** these three checks must pass: `npx tsc --noEmit`, `npm run lint` and `npm run build`.
- **Small fixes:** can go live, then tell me what changed.
- **Ask me first:** new features, database changes, privacy or access changes, or anything that deletes data.
