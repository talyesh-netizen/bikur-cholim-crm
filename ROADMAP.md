# Bikur Cholim Senior Living Resident Support Services CRM

## Product Roadmap

## Project Vision

Build a simple, secure internal CRM for Bikur Cholim of Cleveland's Senior Living Resident Support Services department.

The CRM should help staff:

- Know where Jewish residents are living.
- Record visits and communications.
- Track follow-up work.
- Preserve important history.
- Spend less time managing information.

Phase One is for a small internal team.

Reliability, privacy, and ease of use are more important than adding features quickly.

---

# Phase One Delivery Rules

These rules are mandatory development checks.

## One Feature at a Time

1. Each major roadmap feature must be built on its own branch.
2. Each branch may contain only one major roadmap feature.
3. Do not begin the next feature until the current feature has been reviewed and approved by the product owner.
4. Do not combine two roadmap features into one pull request or one large development batch.

Suggested branch names:

- `feature/facilities`
- `feature/residents`
- `feature/interaction-log`
- `feature/family-contacts`

## Change Size Limit

Stop and ask for approval before continuing when either limit is reached:

- More than 1,000 changed lines, excluding generated files and lockfiles.
- More than 25 changed files.

When a limit is reached:

1. Stop development.
2. Explain why the change became large.
3. Suggest how it can be divided into smaller reviewable parts.
4. Wait for approval before continuing.

## No Early Scaffolding

Do not create functionality for later roadmap features.

This includes:

- Database tables
- Database fields
- Routes
- Screens
- Buttons
- Fixtures
- Demonstration records
- Background services
- Types
- Tests
- Placeholder workflows

Only create something for a later feature when it is strictly required for the currently approved feature.

If that happens, explain the dependency before creating it.

## Feature Completion Check

Before presenting a feature for review:

1. Confirm that only the approved feature was implemented.
2. Run its feature tests.
3. Verify that previously approved features still work.
4. Test the main desktop workflow.
5. Test the main mobile workflow.
6. List known limitations.
7. Stop and wait for product owner approval.

---

# Phase One Build Order

## Completed Foundation

- Secure login
- Database foundation
- Security foundation
- Application shell
- Shared organization and application configuration

## Major Features

Build these in order:

1. Facilities
2. Residents
3. Thin Interaction Log
4. Family Contacts
5. Facility Staff and Community Contacts
6. Follow-Up Tasks
7. Resident Transfers
8. Expanded Interaction Log
9. Dashboard
10. Search and Filters
11. Mobile Refinement
12. CSV Import

---

# Feature Scope

## 1. Facilities

Staff can:

- View facilities.
- Add a facility.
- Edit a facility.
- View basic facility details.
- Mark a facility active or inactive.

Do not add residents, contacts, interactions, tasks, or transfer fixtures as part of this feature.

## 2. Residents

Staff can:

- View residents.
- Add a resident.
- Edit basic resident information.
- Connect a resident to a current facility.
- Mark a resident's current status.

Do not build family contacts, interactions, tasks, or transfer workflows as part of this feature.

## 3. Thin Interaction Log

This is the first version of the CRM's central workflow.

Staff can quickly record:

- The resident.
- The facility where the interaction occurred.
- The interaction date and time.
- The interaction type.
- A short note.
- The staff member who recorded it.

The workflow must be fast and usable on a phone.

This first version does not require family contacts or facility staff contacts.

## 4. Family Contacts

Staff can:

- Add multiple family contacts to a resident.
- Edit contact information.
- Identify one contact as primary when appropriate.
- Record the person's relationship to the resident.

## 5. Facility Staff and Community Contacts

Staff can:

- Add facility staff contacts.
- Add community contacts.
- Connect contacts to facilities when appropriate.
- Record basic contact details and roles.

## 6. Follow-Up Tasks

Staff can:

- Create a follow-up task.
- Assign it to a staff member.
- Connect it to a resident, facility, or interaction.
- Set a due date.
- Complete or cancel it.
- See overdue tasks.

## 7. Resident Transfers

Staff can:

- Move a resident to a new facility.
- Record the transfer date.
- Preserve the previous facility.
- View the resident's complete facility history.

Transfer rules are defined below.

## 8. Expanded Interaction Log

After contacts and tasks exist, interactions may also connect to:

- Family contacts.
- Facility staff.
- Community contacts.
- Follow-up tasks.

Do not redesign the basic mobile logging workflow unless product owner testing shows that a change is needed.

## 9. Dashboard

The dashboard should help staff understand:

- What needs attention today.
- Overdue follow-up tasks.
- Residents overdue for visits.
- Facilities needing attention.
- Recent activity.

## 10. Search and Filters

Staff can search and filter approved non-sensitive summary information.

Search privacy rules are defined below.

## 11. Mobile Refinement

Review all completed workflows on a phone.

Improve:

- Tap targets.
- Form length.
- Navigation.
- Loading states.
- Error messages.
- Readability.

## 12. CSV Import

Allow controlled import of approved Phase One records.

Do not import real resident information until the application has passed product owner testing and privacy review.

---

# Privacy Rules

These rules apply to every Phase One feature.

## 1. Search Results and List Views

Resident search results and list views may display only the minimum information needed to identify the correct record.

Allowed examples:

- Resident name.
- Current facility.
- Resident status.
- Last interaction date.
- Next follow-up date.

Do not display in search results or list views:

- Interaction note text.
- Medical details.
- Diagnoses.
- Private family information.
- Phone numbers or email addresses unless the screen specifically requires them.
- Sensitive alerts or internal concerns.

Sensitive information should appear only after an authorized staff member opens the appropriate record.

## 2. Logs and Third-Party Services

Never send resident or family information to:

- Error monitoring services.
- Analytics services.
- Public logs.
- Browser console logs.
- URLs.
- External AI services.
- Other third-party systems.

This includes:

- Names.
- Contact information.
- Interaction notes.
- Medical information.
- Facility room details.
- Family concerns.

A new third-party service may not receive CRM data without explicit approval.

## 3. Interaction Notes

Interaction notes must:

- Be connected to the appropriate resident.
- Be visible only to authenticated staff.
- Stay inside the CRM.
- Not appear in email notifications, text messages, URLs, or general dashboards.
- Not appear as search-result snippets.

Notes should contain only information needed for resident support and follow-up.

## 4. Deletion and History

Phase One should use archive or inactive statuses instead of routine permanent deletion.

Deleting or deactivating a resident must never silently erase:

- Interaction history.
- Facility transfer history.
- Completed task history.
- Audit history.

Permanent deletion should require a separate approved administrative process.

## 5. Exports

Phase One should not provide unrestricted bulk export of interaction notes or private resident information.

Any future export feature must define:

- Who may export.
- What fields may be exported.
- Why the export is needed.
- How the exported file will be protected.

---

# Approved Workflow Decisions

## Resident Transfers

When a resident transfers:

1. The resident keeps the same resident record.
2. All interaction history remains connected to the resident.
3. Each past interaction keeps the facility where it originally occurred.
4. The previous facility remains in the resident's transfer history.
5. The resident's current facility changes to the new facility.

### Open Follow-Up Tasks

Open tasks follow the resident by default.

If a task is specifically tied to the old facility, the transfer workflow must ask the staff member to choose:

- Move the task with the resident.
- Keep the task connected to the old facility.
- Complete the task.
- Cancel the task.

Do not silently cancel or reassign facility-specific tasks.

## Deceased Residents

Do not delete the resident.

Change the resident's status to `Deceased`.

Record the date when known.

Deceased residents:

- Do not appear in active resident lists by default.
- Do not appear as overdue for visits.
- Keep their interaction, task, contact, and transfer history.
- Can still be found using an appropriate status filter.

## Discharged or No Longer Served Residents

Do not delete the resident.

Use an inactive status such as:

- Discharged
- Returned home
- Moved out of service area
- No longer receiving support

Inactive residents:

- Do not appear in active work lists by default.
- Keep all historical records.
- Can still be found using status filters.

## Primary Family Contact

A resident is not required to have a family contact.

When family contacts exist:

- The system may allow one contact to be marked as primary.
- No more than one family contact may be primary at the same time.
- The system should not block saving a resident because no primary contact exists.
- Changing the primary contact should remove the primary designation from the previous contact.

## Staff Roles

Phase One assumes one standard internal staff role.

All approved Phase One staff users have the same normal CRM access.

Do not build different business permission levels during Phase One.

Account creation and system administration may be handled separately, but Phase One workflows should not change based on multiple staff roles.

More detailed roles and permissions are intentionally deferred.

---

# Design Principles

- Use plain language.
- Keep screens uncluttered.
- Minimize unnecessary clicks.
- Make interaction logging fast on mobile.
- Preserve resident history.
- Protect private information.
- Prefer clear workflows over advanced options.
- When uncertain, choose the simpler approved workflow.
- Do not silently make unresolved product decisions.

---

# Intentionally Deferred

Do not implement these during Phase One without explicit approval:

- Multi-department support
- Multi-organization support
- Volunteer portal
- Family portal
- Text messaging
- Email automation
- Calendar synchronization
- Route optimization
- Knowledge base
- Facility maps
- AI assistance
- Advanced reporting
- Advanced analytics
- Detailed staff permission roles
- Unrestricted data exports

---

# Long-Term Direction

Future phases may support additional Bikur Cholim departments, teams, volunteers, family communication, and automation.

Those features should be designed from real operational requirements.

Phase One should remain focused on creating a reliable Senior Living Resident Support Services CRM.
