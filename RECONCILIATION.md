# CRM walkthrough and reconciliation tracker

Started Oct 14, 2026. The director walks through the live CRM record by
record, comparing it with the original workbook ("Senior Support
Services Tracking Sheet", Google Drive). ChatGPT guides the walkthrough
and organizes decisions; Claude prepares each batch and keeps this file.

**Rules:** nothing is skipped because it looks right; a record is
"Verified and Closed" only after the director has opened it and its data
and relationships have been checked; no database change without the
director's explicit approval; small fixes go to the backlog, not into
the walkthrough.

**No personal names in this file.** Residents, family and individual
staff are referred to by role and facility; the names are in the batch
sheet Claude gives in the chat and in the CRM itself.

**States:** Not Reviewed → Under Review → Reviewed, Issues Pending →
Verified and Closed

## Where we stopped

**Batch 1 — Progressive Quality Care: prepared, waiting for the
director to open it.** Next record: the group page.

## Walkthrough order (whole system)

| # | Area | Size | State |
|---|---|---|---|
| 1 | Healthcare groups, in the CRM's order, each with its facilities, residents, staff and family | 24 groups, 40 facilities (+3 under "Judson Senior Living", see D-012) | Batch 1 under review |
| 2 | Facilities with no group | 86 | Not Reviewed |
| 3 | Residents not reached through 1–2 | from 197 | Not Reviewed |
| 4 | Contacts: family, facility staff, volunteers, rabbis, community partners | 343 | Not Reviewed |
| 5 | Strategic partners | 15 | Not Reviewed |
| 6 | Interactions, Impact and reports | 1,674 entries | Not Reviewed |
| 7 | Tasks | 46 | Not Reviewed |
| 8 | Dashboard, Quick Log, on-site visit, search, menus | — | Not Reviewed |
| 9 | Settings and staff accounts | 5 users | Not Reviewed |

Areas 3–9 are reviewed for what batches 1–2 don't already cover.

## Batch 1 — Progressive Quality Care

| Record | Workbook | State |
|---|---|---|
| Group page: Progressive Quality Care | Healthcare Groups tab H013 | Under Review |
| Avenue at Aurora (+3 residents, 2 staff, 2 family, 33 entries) | F008 | Not Reviewed |
| Avenue at Brooklyn (+1 resident, 1 open task, 0 entries) | F123 | Not Reviewed |
| Avenue at Macedonia (+2 staff, 1 entry) | F015 | Not Reviewed |
| Avenue at Strongsville (+1 staff, 1 entry) | F016 | Not Reviewed |
| Avenue at Warrensville (+2 staff, 1 entry) | F017 | Not Reviewed |
| Parma Care Center (+1 staff, 3 entries) | F082 | Not Reviewed |

Prepared check: all 39 workbook entries for these six facilities are in
the CRM, matching one for one by date, kind and person (Aurora 33,
Parma 3, Macedonia 1, Strongsville 1, Warrensville 1, Brooklyn 0).

## Data issues

| ID | Batch | Issue | State |
|---|---|---|---|
| D-001 | 1 | Parma Care Center under Progressive: workbook says so; state license names "Parma Nursing Home, Inc." with no link to Progressive | Open |
| D-002 | 1 | Avenue at Strongsville under Progressive: workbook group blank; state license is "Strongsville Healthcare and Rehabilitation LLC" at Progressive's office and phone | Open |
| D-003 | 1 | Avenue at Brooklyn under Progressive: workbook group blank; state license is "Progressive Brooklyn, LLC" | Open |
| D-004 | 1 | The workbook's Progressive contact (owner) is not in the CRM; the group has no contacts | Open |
| D-005 | 1 | Workbook names a primary contact for 5 of the 6 facilities (Aurora's has since left); none is marked primary in the CRM | Open |
| D-006 | 1 | Avenue at Brooklyn shows "Recurring visits" but has no entries; one referred resident with an open "Visit" task | Open |
| D-007 | 1 | Parma Care Center type: CRM "Memory care"; workbook "Nursing Home & Rehab/Memory Care"; state "Nursing Home" | Open |
| D-008 | 1 | Website field holds a name, not a web address, for 5 of 6; zip and phone blank on all 6 (state list has phones for 4) | Open |
| D-009 | 1 | Workbook notes on 2 Aurora residents were not carried into the CRM | Open |
| D-010 | 1 | State list shows 2 more Progressive buildings (Avenue at Broadview Heights, Avenue at Lyndhurst) that are in neither the workbook's Facilities tab nor the CRM | Open |
| D-011 | 1 | Warrensville address misspelled "Intercahnge" (same in workbook) | Open |
| D-012 | — | QA-002: 3 facilities list "Judson Senior Living", which has no group record, so they don't appear under Healthcare groups | Open |
| D-013 | — | The Oct 12 Judson Manor single-record correction (separate approval) | Open |
| D-014 | — | 22 of the 36 QA-007 food deliveries have no resident and no people count | Open (only if wanted) |

## Usability issues

| ID | Batch | Issue | State |
|---|---|---|---|
| U-001 | — | QA-003: "Add group" highlights Strategic Partners in the menu | Open |

## Development backlog (separate from the walkthrough)

| Item | Status |
|---|---|
| PR #140: facility visit-days, one notes area, Add to facility profile (QA-005/006) | TESTED, waiting for merge approval |
| Remove "Start visit here" from facility pages | DISCUSSED |
| Rename "Facility staff (meeting, touchpoint, appreciation)" to "Facility staff interaction", keeping the AI hint | DISCUSSED |
