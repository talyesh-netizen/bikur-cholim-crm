# October 27 cleanup: QA notes (PR #145)

Preview (TEST database, fake data only):
https://bikur-cholim-crm-git-claude-oct-2-d26ccb-bikur-cholim-cleveland.vercel.app

## Results so far

| Step | What was checked | Result |
|---|---|---|
| 1 | Logging from a staff member's page (Carlos Ruiz) | **Change requested:** director chose A (see below) |
| 2 | Two staff in one conversation | **Pass:** two separate entries (Dana Activities, Carlos Ruiz), same day, place and note |
| 3 | Food form | **Pass:** one number, "How many people received food?", no item count. **Change requested:** hide the Resident box (answer 2) |
| 4 | Program form | **Pass:** saved with 5 students, 4 volunteers, 11 residents reached, no facility (checked in the TEST database) |
| 5 | Family form | **Pass:** saved with no resident or facility (checked in the TEST database). **Change requested:** the family box offered a staff member (answer 3) |
| 6 | Facility visit under "More types" | **Pass:** saved at Hillcrest Independent Living, in person, counts as a facility visit (checked in the TEST database). **Change requested:** a short reminder of when to use it (answer 4) |
| 7 | Facility staff: address and role | **Pass:** no address fields (Oct 28: an empty "Address" line still showed on the staff page, now removed); role is a dropdown. Extra check added by the director: a newly added staff member must show up when logging (7b) |
| 7b | New staff member appears when logging | **Pass:** "Test" saved as facility staff (Life Enrichment Director, Cedarbrook) and a staff conversation with them saved (checked in the TEST database). Two open questions for ChatGPT below (Q5, Q6) |
| 8 | Impact page | **Pass:** shows staff interactions (one per person), Staff visits beside Facility visit-days, partner conversations and the Programs box (5 students, 4 volunteers) matching what was logged. Open question Q7 on wording |
| 9 | Funder export | **Pass (with a note):** the report downloads. The director's Mac opens CSV files with the ChatGPT app, which couldn't open it, so Claude checked the contents in the code: no item count, "People who received food", Staff visits, Partner conversations, Program participation (students / volunteers / not split). Worth opening once in Numbers or Excel |
| 10 | Stories | **Pass:** story saved, written by Director (practice), linked to resident Esther Practice and Deer Creek Lodge; no activity entry created (checked in the TEST database). Linking an existing story later was covered by the automated access checks |

## Step 1 finding (director, Oct 27, 2026)

On Carlos Ruiz's page, the director used the red **+ Log** button in the side
panel, and the form opened with Carlos already filled in. The director found
this confusing: the side panel's button is a general "log anything" button,
so it shouldn't quietly attach whoever's page happens to be open.

How it works now:
- **Side panel "+ Log":** on a resident's, staff member's, family member's,
  volunteer's or partner's page, it opens the form with that person filled in.
  On other pages it opens a blank form.
- **Resident pages:** also have their own large **Log** button at the top
  (since Oct 19, 2026).
- **Staff, family, volunteer and partner pages:** only have a small "Log an
  interaction" button further down, in the Interactions section.

## Question for ChatGPT

Background: The CRM has a red "+ Log" button in the side panel on every
page. In this build it fills in the person whose page is open. The director
tried it on a staff member's page and found that confusing: the side panel
button should be general, not tied to the page.

- **A. The side panel "+ Log" always opens a blank form, on every page.**
  Each person's page (staff, family, volunteer, partner and resident) gets
  its own clear button at the top: "Log with Carlos Ruiz".
  - Upside: one clear rule. The side panel button is general, and the
    button on someone's page is for that person.
  - Downside: logging from a profile means using the page's button, not the
    side panel.
- **B. Same as A, but resident pages keep today's behaviour,** where the
  side panel fills in the resident (as decided Oct 19).
  - Upside: residents work as staff are used to.
  - Downside: the side panel behaves differently on resident pages than on
    other people's pages.
- **C. Keep this build as it is,** but change the side panel button's label
  on a person's page to "+ Log with Carlos" so it's clear.
  - Upside: smallest change.
  - Downside: the side panel button's meaning still changes from page to page.

Claude recommends **A**: it is the simplest rule to remember, and it gives
every profile the same visible button residents already have.

Please reply A, B or C and why.

## Director's answers

1. **Side panel "+ Log": A.** The side panel button always opens a blank form.
   Every person's page (staff, family, volunteer, partner and resident) gets
   its own clear "Log with [name]" button at the top.
2. **Resident box on Food and Programs: B (hide on both).** Food and programs
   aren't about one person. If someone has a meaningful conversation with a
   resident at a program, it's logged separately as its own entry. The 10
   older food entries that already have a resident keep it, unchanged.
3. **Who appears in the Family box: A (family members only).** In QA the
   family box offered everyone, and a staff member (Carlos Ruiz) was saved as
   "family". Only people filed as family members should be offered.
4. **Reminder on Facility visit: yes.** When Facility visit is picked, the form
   shows: "Use this when you went to the facility but didn't meet any
   residents or staff. If you did, log those visits or conversations
   instead." (Matches the Oct 21 rule for Facility visit.)

## Open questions for ChatGPT (director wants ChatGPT's view first)

**Q5. Logging right after adding a new staff member.** Today, adding a new
facility staff member and logging a conversation with them are two separate
steps: save the person, then click "+ Log" and find them again. The director
felt it should be one smooth step.
- **A.** The new-staff form gets a second button, "Save and log a
  conversation". It saves the person, then opens the log form with that person
  and their facility already filled in. Upside: one step when you've just met
  someone new. Downside: one extra button on the form.
- **B.** Keep it as it is. Upside: no change. Downside: two steps, and you have
  to find the person again.
- Claude recommends **A**.

**Q6. Which staff appear in "Who you spoke with".** In QA, a staff member who
works at Cedarbrook was picked for a conversation logged at Deer Creek Lodge.
The box offers facility staff from every facility, whatever facility is chosen
on the form.
- **A.** Once a facility is chosen, list that facility's staff first, then
  everyone else below. Upside: the right people are on top, and someone who
  works at two places can still be picked. Downside: a mismatch is still
  possible, just less likely.
- **B.** Once a facility is chosen, show only that facility's staff. Upside: no
  mismatches. Downside: someone not yet linked to that facility can't be picked
  until they're linked.
- **C.** Keep it as it is.
- Claude recommends **A**.

**Q7. How much explanation on the Impact page.** Under each number on the
Impact page there is a line explaining what it counts, for example "each staff
member once per facility per day they were there". The director finds this
too much to read.
- **A.** Shorten each line to a few words ("per person, per day", "per
  facility, per day", "calls included"), with the full explanation shown only
  when you hover or tap a small "i" next to the number. Upside: much calmer
  page, and the difference between similar numbers is still visible.
  Downside: the full meaning is one tap away.
- **B.** Remove the lines entirely. Upside: cleanest. Downside: "Staff visits"
  and "Facility visit-days" look alike with nothing to tell them apart.
- **C.** Keep them as they are.
- Claude recommends **A**.

Please reply Q5 A/B, Q6 A/B/C and Q7 A/B/C, with a line of reasoning each.

## Final answers (ChatGPT and director, Oct 27, 2026)

- Q5: **A**, "Save and log a conversation" on the new-staff form.
- Q6: **A**, the chosen facility's staff first, each person showing where they work.
- Q7: **A**, short explanations with the full definitions behind an "i".
- Change to answer 2: **Food keeps an optional Resident** (a delivery made for one
  person stays on their history); the Resident box is hidden on Programs only.

## Built on the TEST preview for the final check

1. Side panel "+ Log" opens a blank form on every page; resident, staff, family,
   volunteer and partner pages have "Log with [name]" at the top.
2. No Resident box on Programs; Food keeps an optional Resident.
3. Family offers family members only. Anyone picked before is set aside, not
   saved as family, and comes back if another kind is picked.
4. Facility visit shows: "Use this when you went to the facility but didn't
   meet any residents or staff. If you did, log those visits or conversations
   instead."
5. New-staff form: "Save and log a conversation".
6. "Who you spoke with": the chosen facility's staff first, each showing role
   and facility.
7. Impact: a few words under each number; full definitions behind an "i".

Checks: type check, lint and build pass; 44 counting and "+ Log" checks pass;
32 browser checks on the log form pass.

## Final check: director's notes (Oct 28, 2026)

"Save and log a conversation" worked (the new staff member and the
conversation saved at Hillcrest, in person at the facility). Two changes
asked for, built on the TEST preview:

1. Picking a facility staff member fills in the facility they work at,
   when no facility is chosen yet (also "Log with [name]" from their page).
   Someone linked to two or more facilities fills in nothing; pick one.
2. "How?" has nothing picked in advance on a staff conversation or a
   volunteer meeting, and a new one must pick. On-site mode still starts
   on in person, since you are at the facility.

Checks: type check, lint and build pass; counting checks pass; 38 browser
checks on the log form pass.

## Final check result (director, Oct 28, 2026)

All seven QA adjustments checked on the TEST preview, plus the two Oct 28
changes. Impact page: "reads well" (short words, full definitions behind
the "i"). Open: the "How?" question (required or optional) with ChatGPT.

## Later, not in this round (director, Oct 28, 2026)

- **Stories: a date option.** Today a story takes the day it was written
  automatically. The director would like to be able to set the date (for
  a story written down days later). Not built now: the priority is
  finishing this round so the CRM can be used.
- The "How?" choice (required or optional) goes to ChatGPT; it is built
  as required on the TEST preview until answered.

## Final decisions (ChatGPT and director, Oct 28, 2026)

1. "How?": **A**, required on new staff conversations and volunteer
   meetings (as built), for accurate visit counting.
2. Manual QA before going live: items 14 (side panel "+ Log" blank),
   15 ("Log with [name]"), 28 (funder export opened in a spreadsheet)
   and 31 (Quick Log) are to be clicked through on TEST.
3. Production: **not yet approved.** The merge and the two production
   database updates wait for those checks and the director's approval.

Later, separate from PR #145: assess a daily morning email of each
employee's tasks (due today, tomorrow, next 7 days).

## Manual checks (Oct 28, 2026)

- 14 Side panel "+ Log" opens blank: **Pass.** (Found: an empty "Address"
  line still showed on facility staff pages; removed.)
- 15 "Log with [name]": **Pass.** Carlos Ruiz and Cedarbrook filled in;
  Family left him out (not family).
- 28 Funder export: **Pass.** Read by Claude from the downloaded file: no
  item count; Staff visits, Partner conversations and Program
  participation (students 5, volunteers 4, not split 0) present.
- 31 Quick Log: to do.

## Open list for ChatGPT (collect now, build after approval)

1. **Resident box on the log form** (question sent): A clearer wording
   "About a resident? (optional)"; B hide on staff conversations and
   Other; C leave. Claude recommends A.
2. **Stories date option** (director): set the date of a story written
   down later.
3. **Funder export, students shown twice:** "School & shul programs"
   has its own Students/Volunteers lines (0) and "Program participation"
   has the totals (5 and 4), because the test program was at a facility.
   Two places for the same thing may confuse a funder; suggest one.
4. **Funder export, volunteer list:** the bottom "Volunteer impact"
   list shows Ben Horowitz with 1 visit, while the summary above says 0
   volunteer visits. He was tagged as a volunteer on a staff
   conversation, and the bottom list counts every entry a volunteer is
   on. Suggest counting only volunteer visits there, or renaming the
   column "Entries".
6. **Interactions date range kicks you out while typing** (also on the
   live site): the list reloads as soon as the box holds any complete
   date, and typing "2026" counts as complete at the first "2". Fix:
   reload only when done (click away / Enter) or an Apply button.
7. **Quick Log can't be tried on TEST:** the AI key is set for the live
   site only, so the test site hides Quick Log. A: add the key to the
   test site; B: rely on the automatic checks.
8. **Daily task email** (assessment, separate from PR #145): a daily
   email already exists in the code but has never sent (Resend account,
   sending domain and three settings never set up; LAUNCH_READINESS.md).
   It sends counts only (overdue, due today), Sun-Fri around 8 am.
   Adding tomorrow and next 7 days is small. Cost: free at our size.
9. **Pre-existing (not this PR):** the live service-role key is set for
   every preview deployment; preview-only builds don't need it.
5. **CSV opens in the ChatGPT app** on the director's Mac. Not a CRM
   problem (the Mac's default app for .csv); open with Numbers or Google
   Sheets, or a later option to download as Excel.

## Decisions on the open list (ChatGPT and director, Oct 28, 2026)

1 A before · 2 A after · 3 A before · 4 A before · 5 B after (no Excel
export) · 6 A before · 7 A before (TEST only; AI key server-side only)
· 8 A/A after (counts only; only when something is due within 7 days;
assessment only) · 9 remove the live administrator key from test and
preview environments before going live, production unaffected.

Built on the development branch: 1, 3, 4, 6. Settings: 7, 9 (see the
final report).

## Settings for the final check (Oct 28, 2026)

- Item 9: `SUPABASE_SERVICE_ROLE_KEY` is now Production only (was
  Production and Preview). Only staff sign-in creation/removal and the
  daily reminder (live only) use it. Older preview deployments built
  before today still hold it; all are behind Vercel login and it is
  server-only. Full fix at go-live, with approval: create a new key in
  Supabase, set it for Production, merge, check staff sign-ins, then
  switch off the old key.
- Item 7: a separate test Anthropic key was added for Preview on this
  branch only (server-side name, no NEXT_PUBLIC). Delete it in the
  Claude Console after Quick Log passes.
- Noticed: the live Anthropic key appears to expire Nov 5, 2026; renew
  or replace before then or live Quick Log stops.

## Go-live log (approved by the director, Oct 28, 2026)

1. Backup: the director downloaded More → Backup from live; row counts
   matched the live database exactly.
2. Database updates applied to live: 20261027000001 (program student and
   volunteer numbers) and 20261027000002 (Stories). Fingerprints of
   interactions, residents, contacts and tasks identical before and
   after; no existing record changed.
3. Stories access check on live: 20 of 20 PASS, rolled back (no test
   stories, staff accounts unchanged). No new security advisor warnings.
4. Administrator key replaced: new secret key `crm_live_oct28` set for
   Production only; live redeployed on the same code; a temporary staff
   account was created and deleted through it (seen in Supabase logs).
   The unused "default" secret key was deleted. The live site was moved
   to the publishable key and checked (all requests 200), then the
   legacy anon/service_role keys were switched off. Old copies of the
   administrator key no longer work.
5. Merge of PR #145: type check, lint, counting checks and build pass.

## Open list for ChatGPT: Impact audit, October 2026 (Nov 2, 2026)

Documentation only: nothing below is approved or built. Scope is
October 2026 (the test period); earlier reporting periods are not
reopened and no saved record is changed. Read-only check of live data;
full write-up with tables in the audit file sent to the director.

### A. Findings (what the CRM does today)

1. **Volunteer visit, one resident only.** The form takes one resident
   (or a "Residents reached" number); only a staff Visit takes several.
   With "Residents reached" nobody is named, so those residents don't
   count as served one-on-one and still look "not visited". Volunteer
   visits count toward residents served, volunteer visits, volunteer-only
   days and the volunteer list; never as a staff visit, even if staff
   went along (Oct 20 and 21, Heritage of Lyndhurst: lead Rabbi Alyesh,
   no staff credit either day).
2. **Resident phone calls** count toward residents served one-on-one,
   but not toward "last visit", "Time since last visit", Needs attention
   or the dashboard's not-visited list. Only 1 call logged in October.
3. **Residents at home (one active resident, "Resident A").** A phone call (also Visit, Food,
   Referral, Volunteer visit) must have a facility; the database allows
   none, only the form blocks it. Resident A's Oct 22 call was saved under Deer
   Creek Lodge (to be confirmed). Resident A shows on Needs attention as both
   "location unknown" and "never visited".
4. **"Never visited" list:** 20 active residents with no in-person
   visit; 18 have no contact at all, 2 have other contact (Resident A is one).
   The list can't tell "called weekly" from "no contact".
5. **Program double count.** Oct 15 Fuchs Mizrachi program: edited
   Oct 29 to add 90 students; its older "not split" 90 was kept, so
   Programs shows 90 students + 90 not split (180, not 90). The edit
   form keeps the old number.
6. **Food undercount.** "People who received food" blank on Oct 23
   Vitalia Highland Heights (9 items) and Kemper House (10 items), and
   on two Oct 7 Legacy Place deliveries for one resident each: all count
   as 0 people. October shows 52; possibly about 73 (to be confirmed).
   Oct 7 has two Vitalia delivery entries (8 and 3): two deliveries or
   one split? No volunteers tagged on any October delivery.
7. **Staff visits (October):** 52 staff visits, 41 facility visit-days,
   2 volunteer-only, 26 facilities visited, 27 engaged. 103 in-person
   entries counted by kind (no "how" recorded). Of 23 staff
   conversations with no "how", only 1 might be a missing visit-day.
8. **Partners:** 11 partner conversations (11 people), 39 facility staff
   interactions (29 people). 2 "Other" entries with people filed as
   volunteers count nowhere on Impact.
9. **Drill-down gaps.** No list behind the facility numbers, volunteer
   visits, partner conversations or program head counts. "Facility staff
   supported" and the staff leaderboard open lists that don't match the
   number (staff list includes volunteer visits: Rabbi Alyesh +2 in
   October). Lists include "Same visit" copies (none in October).
   "Reached" adds group-visit numbers the list doesn't show (0 in
   October). Growth "New residents" counts any first entry, not only a
   visit or call.
10. **Oct 22 "program"** at Cleveland Clinic Rehab Science Park with 1
    resident reached: a one-on-one visit logged as a program? Check.
11. **Volunteer visit needs a staff "Done by"** (director, Nov 2, 2026).
    A volunteer visit (one volunteer tagged) wouldn't save: "Please add who
    did it (at least one person)." Done by starts with the person logging;
    once emptied, the form won't save. The hint says "Who arranged it",
    but the CRM treats this person as the lead, gives them no staff visit,
    and still lists the entry under their name on the staff list (see 9).
    Workaround today: add yourself back under Done by. Ties to Q4.

### B. Recommended changes (for approval; none built)

- R1 Allow no facility on a resident call (and visit elsewhere, food for
  one person, referral) when the resident has no facility on file.
- R2 Volunteer visit takes several residents, one record each.
- R3 Once students/volunteers are entered on a program, stop counting
  its old "not split" number.
- R4 Food with no people number shows "not recorded" (not 0) and is
  listed on Data Quality to fill in.
- R5 Show "last contact" (calls included) beside "last in-person visit";
  word the lists "no in-person visit".
- R6 Volunteer visit: "Staff went too" tick box gives staff a visit.
- R7 Every Impact number opens a list counted the same way.
- R8 Note how many in-person entries were counted by kind.

### C. Decisions needed (director with ChatGPT)

Q1 Residents at home: A allow no facility / B keep requiring one.
Q2 Volunteer visit, several residents: A one record each / B as now.
Q3 "Not visited" lists: A in-person only plus "last contact" shown /
   B count calls as visits.
Q4 Staff with a volunteer: A "Staff went too" tick box / B as now.
Q5 Food with no people number: A "not recorded" and fill in /
   B use the item count.
Q6 Program old number: A stop counting it once split / B fix by hand.
Claude recommends A on all six. Reply A or B for each, and why.

## Open list for ChatGPT: Impact page inventory and overlaps (Nov 2, 2026)

Second pass, separate from the October audit above (its findings 1-11
and Q1-Q6 stay as written and stay open). Documentation only: nothing
approved or built, no saved record changed, October 2026 only. Full
inventory of every number, with October values, sent to the director.

### A. New findings (12-20)

12. **Export "School & shul" misses current school programs.** It
    counts only the old "School & shul program" kind, which the form no
    longer offers. October shows 0, though a 90-student school program
    (a Program with a school as partner) happened. There is no "schools
    involved" number anywhere.
13. **Export lines the form no longer asks for:** staff hours (3.3 from
    3 entries), volunteer hours (0), unmet need (0), funder stories (0)
    read as if real.
14. **Two resident numbers count differently.** "Visits & calls per
    month" includes visits with no resident named; the headline doesn't
    (September 39 vs 37; October happens to match at 141 + 2).
15. **"Reached by holiday"** leaves out students (the 90 at the Shabbos
    school program) and deliveries with the people number blank.
16. **"Most-supported facility teams"** says "staff conversations" but
    counts staff people met, including at programs; bars open the
    facility page, not its entries.
17. **"Today" charts** (time since last visit, family on file, facility
    stages, growth) sit among period numbers, barely marked.
18. **Comparison arrows** compare with September, a less completely
    logged month (97 vs 36 residents).
19. **Worked out, never shown:** what families needed; care navigation.
20. **Needs attention uses two meanings of "contact":** residents need
    an in-person visit; facilities count any entry, calls included.

### B. Overlapping activities (how the page counts them today)

- **School brings 25 students to visit 10 residents** (logged as a
  Program at the facility, school as partner, students 25, residents
  reached 10): +1 program, +25 students, ~10 reached, +1 facility
  visit-day and a staff visit for whoever is under Done by, even if no
  staff went. Residents not named, so no one-on-one count and no "last
  visit" change. Export "School & shul": 0 (finding 12). If logged
  instead as a Visit with 10 residents: 10 visits, but the students
  aren't recorded anywhere.
- **Volunteer visits three residents:** 3 separate entries (form takes
  one resident): 3 visits, 3 residents, volunteer tally 3, one
  volunteer-only day. Or one entry with "3 reached": 1 visit, 0
  residents named, residents still look unvisited. (Q2.)
- **Staff member accompanies a volunteer:** volunteer visit alone gives
  staff nothing. Adding a staff Visit for the same resident doubles
  "visits & calls" (+2 for one visit); never flagged, because double-
  entry checks only compare entries of the same kind. (Q4.)
- **Staff delivers food while visiting a resident** (real case: Oct 7,
  Legacy Place, two residents): the Visit counts the resident; the Food
  entry adds a delivery but 0 people (blank). One staff visit and one
  visit-day (no double count). A Food entry alone naming the resident
  doesn't count them as served or reset their "last visit". (Q5.)
- **Program with residents, students and community volunteers:** one
  program; residents reached into the ~ "reached" total; students and
  volunteers as typed numbers; volunteers picked by name aren't counted
  anywhere; residents spoken with one-on-one are separate Visit entries
  and also sit inside "reached" (different numbers, by design). An
  older program's single number mixes students and volunteers (Q6).

### C. Confirmed bugs vs. reporting design questions

Confirmed bugs (a number that contradicts its own label or an approved
rule): program "not split" double count (5); export School & shul (12);
staff leaderboard list includes volunteer visits (9); "Facility staff
supported" and "Reached" lists don't match their numbers (9); "Most-
supported facility teams" label (16); Growth "New residents" label
(9); stale export lines (13); the two resident definitions (14).

Design questions (the code does what was decided; the rule itself
needs a decision): Q1-Q7; holiday chart contents (15); "today" vs
period numbers (17); comparison month (18); the meaning of "contact"
(20); programs and deliveries giving Done-by staff a visit even when
they weren't there (same issue as Q4).

### D. Decisions (Q1-Q5 unchanged and open; Q6 caution; new Q7)

**Q6 caution (director and ChatGPT, Nov 2):** the older single number
may mix students and community volunteers (e.g. the Oct 25 program,
6). Simply ignoring it once students are typed would undercount any
volunteers it held. Options now: A ignore the old number once students
or volunteers are entered (risk: undercount); B count both (as now;
double count); C on edit, ask the person to split the old number
(students + volunteers must add up to it, or confirm it's replaced),
and until then show it once as "not split". Claude recommends C. Open.

**Q7 Separate Impact categories.** Today "reached at programs &
deliveries" adds program attendance and people fed into one number,
and a program's "volunteers" sit next to students with no rule on who
is a student and who is a community volunteer. A: separate sections,
never added together (resident support, facility coverage, programs,
school engagement, community volunteers, food, family, professional
relationships); students count only under school engagement,
community volunteers only under volunteers. B: keep the combined
number with a breakdown under it. Claude recommends A. Open.

## Separate item (not part of the Impact audit): visit notes on resident profiles (Nov 2, 2026)

Request from Sara, via the director: notes written when logging a
visit should be easy to see on the resident's profile before the next
visit, written once and shown in both places (no copying, no second
note to keep up). Investigation only; nothing approved or built.

### Current behavior

- **Resident profile:** "About them" (lasting notes) comes first, open.
  Under it, "Recent interactions" (open) lists the newest 10 entries
  about the resident, of every kind, each with its kind, day, facility,
  "Visited by" (the lead) and the full note in small grey text. "See
  all" opens the full list. So the notes are there, but mixed with
  entries that have none and with family, food and other kinds.
- **On-site mode** (where staff are before going in): opening a
  resident shows "About them" notes and family, plus "Last visit
  [when]". **The last visit's notes are not shown there.**
- **"Who wrote it":** the list shows the lead ("Visited by"), not team
  members. Who typed it is saved separately (entered_by); in October it
  was always the same person as the lead.
- **October data:** 96 of 164 resident entries had a note (about 90
  characters on average, longest about 290). 33 notes were saved on
  several residents at once (one Visit with several residents copies
  the same note to each), so a shared note can mention other people.
- **A separate overview already exists:** "About them" notes (82 notes
  on 60 residents), plus "Private" for anything sensitive.

### Recommendation (for approval)

Show the newest visit notes, read straight from the saved entries
(nothing copied, nothing new saved):
1. Resident profile: a short "Notes from recent visits" box under
   "About them": the newest 3 entries that have a note, each with the
   day and who did it, and a link to the entry.
2. On-site mode: the same newest 1-3 notes when a resident is opened,
   under "About them".
"About them" stays the overview for lasting facts and preferences.
Display only, so Impact numbers, counting and saved records are
unaffected. Voided entries stay hidden; it follows the same access
rules as the profile.

### Decision needed (Q-N1)

A: the box above on the profile and in on-site mode (recommended).
B: profile only. C: leave as is and rely on "Recent interactions".
Also: which kinds count as "visit notes": staff and volunteer visits
and phone calls only (recommended), or every kind (family, food...)?

## Separate item (not part of the Impact audit): a second staff member during an on-site visit (Nov 2, 2026)

Director: when visiting residents on site, a second staff member is
sometimes along, and there's no way to credit them while keeping
one-tap resident logging. Investigation only; nothing approved or built.

### Current behavior

- **On-site one-tap entries** (Visit, staff conversation, family) save
  only the person signed in. There is no "who else" option, so a second
  staff member gets no staff visit for that day.
- **Quick Log (talk or type)**, including the on-site notes box,
  already handles it when the note says so ("visited with Sara", "Sara
  and I saw her"): the colleague is added as a team member on each of
  those entries (never on food), and the check screen shows "With
  Sara". It depends on the words; there's no way to add or remove the
  colleague on the check screen.
- **The regular log form** has "Done by" (several staff; the first
  leads, the rest are the team).
- **Reusable:** all three use the same team-member list on an entry
  and the same database step that saves it. Reports already credit
  each staff member (lead or team) once per facility per day, and
  count the entry itself once.

### Recommendation (for approval)

An optional "Visiting with" choice at the top of on-site mode (pick a
staff member, or nobody), remembered for that visit only on this phone
(like the facility; cleared at "Finish visit" or the next day). Every
entry saved after it is picked, one-tap or Quick Log on site, adds that
person as a team member. Resident logging stays one tap.

Result: one entry per resident (no duplicates); both staff get one
staff visit for that facility and day; facility visit-days unchanged;
the staff list credits both (as "Done by" does today).

Points to settle: (1) apply it to staff and family conversations too,
or resident visits only? (2) the second person should not also log the
same residents on their own phone (that would double count; Data
Quality would flag it for review); (3) if adding the team member fails
after the entry saves, show a clear message and keep the entry.

### Decision needed (Q-N2)

A: "Visiting with" for the whole on-site visit, all entries (staff can
remove it from one entry afterward). B: resident visits only.
C: no new choice; rely on saying "with Sara" in Quick Log.
Claude recommends A.

## Final cleanup batch: decisions and implementation plan (Nov 3, 2026)

Documentation only. Build NOT yet authorized; nothing built, changed or
deployed. October 2026 is the test month; saved records are never
changed by the build; earlier reporting periods are not reopened.

### Approved directions (director and ChatGPT)

- Q1 A: residents at home can have entries with no facility.
- Q2 A: several residents on one volunteer visit; volunteer activity
  counted separately from resident visits.
- Q3 A: in-person visits and phone contact kept apart; last contact
  shown beside last in-person visit.
- Q4 modified A: recorded by / coordinated by / physically attended
  kept separate; volunteer-only activity never gives staff credit.
- Q5 A: missing food counts show as "not recorded", never 0 or guessed.
- Q6 C: legacy program totals kept until accurately split; no double
  counting.
- Q7 A: separate categories (resident support, facility coverage,
  programs, school engagement, community volunteers, food, family,
  professional relationships); activities and people reached both shown.
- Q-N1: existing visit notes shown on resident profiles (and on site)
  with day and author; "About them" stays separate; nothing copied.
- Q-N2: optional second staff member in On-site Mode, picked once per
  facility visit; one-tap logging kept; presence credit for both;
  individual entries credit only staff who took part.

### Detail decisions D1-D8

- D1 Yes, adjusted: "Lives at home" only when confirmed; otherwise
  "No facility recorded". Calls without a facility give no facility
  credit.
- D2 Modified yes: "volunteer facility-days" (each volunteer once per
  facility per day; same-day trips can't be told apart); residents
  visited shown separately.
- D3 Yes: last contact = resident visits, volunteer visits, phone calls
  (not food-only or family calls).
- D4 No: never assume staff attended a program or food delivery; only
  recorded attendance counts; the person entering is not assumed
  present; unknown attendance kept apart from confirmed absence;
  historical records preserved.
- D5 Yes: coordinated-only activity shown apart from staff visits.
- D6 Yes to both: students are not community volunteers; food counts
  as food assistance, a separately logged visit as resident support.
- D7 Conditional yes: unused export lines removed only once the
  director confirms no current reporting obligation needs them; data
  kept.
- D8 Modified yes: "Visiting with" credits the second person's facility
  presence without adding them to every resident entry; no duplicate
  facility visits; resident logging stays one tap.

### Updated plan (changes from the Nov 3 draft)

1. **Q1/D1:** phone calls never need a facility; visits, volunteer
   visits and food need none when the resident has no facility on file
   (saved "in person elsewhere"). Needs attention: "No facility
   recorded". The confirmed "Lives at home" label needs a new resident
   field: **proposed to defer** (see complexity).
2. **Q2/D2:** multi-resident volunteer visit (reuses the staff Visit
   save). Report "volunteer facility-days" and "residents visited by
   volunteers". No database change.
3. **Q3/D3:** "last contact" column added to the resident summary view
   (add-only); shown on the resident page and Needs attention.
4. **Q4/D4/D5:** one add-only column, `lead_attended` (empty = not
   recorded, yes, no).
   - Program and Food: "Done by" becomes "Staff who were there", with
     "No staff were there". Nothing pre-picked; one answer is required
     on new entries. Credit only when recorded.
   - Volunteer visit: lead = "Arranged by" (no credit) plus "I went
     too" and "Other staff who went" (credited).
   - Older programs and food (empty): **no staff credit, shown as
     "attendance not recorded"**, never as absent.
   - Staff list: staff visits (physical) apart from activities;
     coordinated-only apart.
   - "Recorded by" (already saved) shown on each entry.
5. **Q5:** "not recorded" count in reports and export; Data Quality
   list. No database change.
6. **Q6:** report rule: students + volunteers + whatever is left of the
   old number (never more, never less); edit form asks to split it. No
   record changed automatically.
7. **Q7:** eight sections plus a marked "Today" band; school engagement
   from the partner's type; every number clickable to a list counted the
   same way; facility numbers to a simple "Facility presence" table
   (first to cut if needed); listed bugs fixed; export to the same
   sections. D7 lines stay until the director confirms.
8. **Q-N1:** newest 3 visit/call notes with day and author on the
   profile and in on-site mode. Display only.
9. **Q-N2/D8:** "Visiting with [name]" on site saves ONE existing-kind
   "Facility visit" for that person (facility and day), recorded by the
   person picking. Its submission number is made from facility + day +
   person, so the existing duplicate guard blocks a second one (retry,
   second phone). Resident cards are NOT auto-ticked; a small "+ [name]"
   on a card adds them to that one entry (an extra tap only when they
   took part). Quick Log on site unchanged ("with Sara" in the words
   still works). A mistaken pick: void that Facility visit as usual.

### Complexity check

- **Adds complexity:** D4 (form wording, required answer, one column,
  new reporting rule, an "attendance not recorded" line) and D1's
  confirmed "Lives at home" (needs a new resident field). D4 uses
  "Done by" and the team list as they are, so it isn't a redesign.
- **D4 changes October's facility numbers** (read-only check): staff
  visits 52 -> 42 confirmed + 10 not recorded; facility visit-days
  41 -> 34; facilities visited 26 -> 24. Days that relied only on a
  program or food entry: Oct 1, 9, 15, 17, 25. Older months shift the
  same way on screen (saved records and sent reports untouched). A Data
  Quality list lets a person confirm attendance on those entries, one
  at a time.
- **Low:** D2 (wording), D3, D5, D6 (none), D7 (none until confirmed),
  D8 (one saved Facility visit per pick, reusing the duplicate guard).

### Still to confirm before the build

- C1 Defer the confirmed "Lives at home" label (use "No facility
  recorded" for everyone now)? Claude recommends defer.
- C2 Accept October's facility numbers moving to "42 confirmed + 10 not
  recorded" (and 34 visit-days), with a Data Quality list to confirm
  attendance by hand? Claude recommends yes.
- C3 D7: which export lines (staff hours, volunteer hours, unmet need,
  funder stories) any current funder or grant requires.

### Confirmations C1-C3 (director and ChatGPT, Nov 3, 2026)

- C1 Yes: "No facility recorded" for now; the lives-at-home field is
  deferred.
- C2 Yes, with a distinction: new programs and food must record staff
  attendance; older unverified attendance is "not recorded". Confirmed
  staff presence and facility activity are kept apart, so a program or
  delivery that happened at a facility still counts as facility
  activity even when staff attendance is unknown.
- C3: staff hours, volunteer hours and unmet need are removed from the
  standard export (no current reporting need); data kept on file.
  Funder stories leave the export too and stay available through
  Stories.

### C2 in practice (October, read-only check)

Facility numbers become three layers, each facility once per day:

| Number | Oct 2026 |
|---|---|
| Facility activity-days (anything we did in person there) | 43 |
| ... staff presence confirmed | 34 |
| ... staff attendance not recorded (program/food only) | 7 |
| ... volunteers only | 2 |
| Facilities with in-person activity | 26 |
| Facilities with confirmed staff presence | 23 |
| Staff visits confirmed (per person, per facility-day) | 42 |
| Staff visits not recorded (until reconciled) | 10 |

The old "41 facility visit-days" = 34 confirmed + 7 not recorded; the
old "43 total presence" = facility activity-days (unchanged). The old
"26 facilities visited" = facilities with in-person activity
(unchanged). No activity disappears. Of 19 older program/food entries
with unrecorded attendance in October, 7 decide those 7 days; the Data
Quality list shows those first so a person can confirm them one at a
time. Older months display the same way; saved records and sent
reports are untouched.

Extra work: small. Same counting code with one more layer, no extra
database change beyond the planned `lead_attended` column.

Status: plan complete. Build waits for the director's explicit
authorization.

## Final cleanup batch: build and test log (Nov 3, 2026)

Built on branch `claude/keen-galileo-9g9ljw` as approved. Not merged,
not deployed to production; the live database was not changed.

**Safety**
- This branch's Vercel preview was found to use the LIVE database by
  default; before any code was pushed, branch-only preview settings were
  added pointing it at the TEST database (as for PR #145). Earlier
  docs-only previews of this branch used the live settings but carried
  no code change.
- TEST backed up (full copy of the main tables + fingerprints) before
  the database change; fingerprints identical after.
- Database change (add-only), applied to TEST only:
  `20261103000001_staff_attendance_and_last_contact.sql` (undo file in
  `supabase/rollback/`). Live: not applied (checked: no new column).
- One fake resident added to TEST for testing: "Amy Practice-Home",
  no facility.

**Checks**
- Type check, lint and production build: pass.
- Counting checks (`scripts/check-report-rules.ts`): all 62 pass, including
  new ones for attendance, coverage layers, volunteer facility-days,
  the not-split rule, school programs and the no-facility rules.
- October 2026 reconciliation: the real October entries (read-only, no
  names or notes) run through the new code. Every number matches the
  agreed table: activity-days 43 = 34 confirmed + 7 not recorded + 2 no
  staff; staff visits 42 confirmed + 10 not recorded; facilities 26 with
  activity, 23 with confirmed staff, 27 engaged; not split 96 -> 6;
  school programs 1, schools 1, students 90; food 52 people + 4 not
  recorded; residents 97 (140 staff visits, 1 call, 2 volunteer visits);
  families 13 / 21; staff interactions 39 (29 people, 20 facilities);
  partners 11 / 11. Staff list: 119 activities + 2 coordinated only =
  the 121 entries listed (the earlier gap explained).
- Database behaviour on TEST (in a rolled-back transaction, nothing
  kept): program saved with "no staff there"; at-home visit with no
  facility saved as in person elsewhere; last contact set by a call; a
  second companion Facility visit for the same person, facility and day
  refused.

**Not yet done: click-through browser tests.** This session's network
blocks supabase.co and vercel.app, so the screens couldn't be clicked
through from here. To finish: test on the preview (TEST data) with the
checklist below, or allow those two hosts in the session's network
settings and Claude runs the prepared browser script.

Checklist on the preview (TEST data, sign in as a practice account):
1. New Program: can't save without "Staff who were there"; "No staff
   were there" saves.
2. New Food: "Staff were there" + a name saves.
3. Volunteer visit: two residents, "Arranged by", "Staff who went" -> two
   records.
4. Phone call and Visit with Amy Practice-Home, no facility -> both save.
5. Resident page: "Notes from recent visits" shows a note just written.
6. On site: "Visiting with a colleague?" -> pick one; picking again says
   already recorded; "+ With [name]" is off until ticked.
7. Impact: eight sections + Today; tap numbers -> records; Export opens
   with the new sections and no staff hours / unmet need.
8. Needs attention: "No facility recorded"; Data Quality: the two new
   lists.

**Remaining issues / notes**
- Programs and food logged through Quick Log save attendance as "not
  recorded" (never assumed) and appear on the Data Quality list.
- If a colleague's on-site Facility visit is voided, picking them again
  the same day won't record a new one (the duplicate guard).
- A resident with no facility and no in-person visit appears in both
  "No facility recorded" and "No in-person visit in 30+ days".
- Go-live order (with separate approval): backup and fingerprints, apply
  the database change to live FIRST, then merge (the new code reads the
  new columns), then recheck October on live against the numbers above.

## A1-A9 build and test log (Nov 3, 2026)

Built on branch `claude/funny-hypatia-jxltn0`, on top of the final cleanup
batch above, as authorized by the director (Nov 3, 2026). Not merged, not
deployed to production; the live database was not changed.

**Safety**
- Read-only October audit on live (counts and entry ids only): the
  90-student program is the Oct 15 program (one total of 90 plus 90
  students on the same entry; not changed); 4 of 10 October deliveries
  have no people count; 3 October resident entries are at a facility
  other than the resident's current one (left as they are).
- Baselines saved (offline, counts only) for Q2, Q3, October and Q4 from
  the Oct 28 code. Q3 has no "as first recorded" snapshot in the
  database; save one before go-live.
- Preview for this branch points at the TEST database (branch-only
  settings added before any code was pushed).
- Database change (add-only), TEST only:
  `20261103000002_outings_appreciation_school_roles.sql` (undo in
  `supabase/rollback/`). Row counts and fingerprints identical before and
  after. Saving appreciation, an outing, chaperones and a volunteer kind,
  and refusing bad values, checked in a rolled-back transaction.

**Checks**
- Type check, lint and production build: pass.
- Counting checks: 77 pass (15 new: outings, staff who went along,
  students and chaperones, at-home visits and calls, food not recorded,
  food during a visit, appreciation by two staff, referrals and rides).
- The previous-format export, run on the real Q2, Q3, October and Q4
  entries, is identical to the Oct 28 export, line for line.
- New numbers on real entries, October: residents 97, engagements 143;
  activity-days 43 = 34 staff confirmed + 7 not recorded + 2 no staff;
  staff visits 42 confirmed + 10 not recorded; not split 96 -> 6; students
  90; food 52 people + 4 not recorded; outings 2.
- Q3 (already reported): unchanged except staff visits 127 -> 121
  confirmed + 6 not recorded, and volunteer visits 82 entries = 24
  outings (same volunteers, facility and day). Saved records unchanged;
  the previous-format export still shows 82.

**Not done from here:** click-through on the preview (this session's
network blocks vercel.app and supabase.co). Checklist for TEST:
1. Visit for a resident: facility filled in; clear it and save (no facility).
2. Volunteer visit: two residents, one volunteer, "Staff who went" -> two
   entries, Impact shows 1 outing.
3. Same resident visited again the same day -> "Is this a separate visit?"
4. Food: can't save without a number or "Unknown".
5. Edit an older program with a total: keep / replace choice.
6. More types -> Staff appreciation saves with "Staff who were there".
7. Volunteer profile: "Kind of volunteer" = Student.
8. Resident page: five notes with attended / written by, "Full history".
9. Impact: eight sections; Export and "Previous format" both download.

## Go-live readiness follow-up (Nov 3, 2026)

Fixed (TEST/preview only):
- Quick Log: food, programs and staff appreciation now ask "Were our
  staff there?" (and, for food with no number in the note, "How many
  people received food?" or Unknown) on the check screen; Save waits for
  the answers and the server refuses an item without them.
- Older volunteer visits that never said whether staff went: now
  "attendance not recorded" (was "no staff there" / "coordinated only").
  October: 2 facility-days move from "no staff there" to "not recorded";
  Q3: 4. Confirmed staff visits unchanged (Q3 121, Oct 42).
- Volunteer outings before Nov 4, 2026 are labelled as an estimate on the
  Impact page and the export (Q3: all 24 are estimated, from 82 entries).
- Baseline of earlier reporting saved: `reports/BASELINE_2026-11-03.md`
  (totals only). Previous-format export still identical for Q2, Q3,
  October and Q4.

Checks: type check, lint, build pass; 79 counting checks pass.

Shortest hands-on check (TEST preview, practice accounts):
1. Visit a resident who lives at a facility: facility fills in; clear it,
   save. Then log a second visit for them the same day: it asks "Is this a
   separate visit?"
2. Volunteer visit: one volunteer, two residents, add yourself under "Staff
   who went". Two entries; Impact > Community volunteers shows 1 outing.
3. Food: Save refuses until a number or "Unknown" is given.
4. More types > Staff appreciation: save with "Staff who were there".
   Impact > Professional relationships shows 1 activity.
5. Sara: open a resident with notes: five newest, each with day, kind,
   attended and written by; "Full history" opens the rest.
6. Impact: tap three numbers (Residents engaged, Volunteer outings, Food
   not recorded): each list adds up to its number. Download Export and
   Previous format.
7. Quick Log (on TEST, typed note "Brought lunch for the staff at
   Cedarbrook"): it asks "Were our staff there?" before Save.
