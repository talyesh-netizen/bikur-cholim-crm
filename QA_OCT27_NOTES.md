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
| 7 | Facility staff: address and role | **Pass:** no address fields; role is a dropdown. Extra check added by the director: a newly added staff member must show up when logging (7b) |
| 7b | New staff member appears when logging | **Pass:** "Test" saved as facility staff (Life Enrichment Director, Cedarbrook) and a staff conversation with them saved (checked in the TEST database). Two open questions for ChatGPT below (Q5, Q6) |
| 8 | Impact page | **Pass:** shows staff interactions (one per person), Staff visits beside Facility visit-days, partner conversations and the Programs box (5 students, 4 volunteers) matching what was logged. Open question Q7 on wording |
| 9–10 | Funder export, Stories | Not checked yet |

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
