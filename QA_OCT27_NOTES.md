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
| 6–10 | More types, staff role, Impact, funder export, Stories | Not checked yet |

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
