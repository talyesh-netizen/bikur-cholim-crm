import type { Directory } from "@/lib/assistant/directory";
import type { ModelPlan, Plan, PlanNames, PossibleMatches } from "@/lib/assistant/schema";
import { orgLocalToIso, toOrgDatetimeLocalValue } from "@/lib/format-date";
import { capitalizeWords } from "@/lib/format-text";
import { residentName } from "@/lib/domain/resident-name";

/** Interaction types that mean someone was physically at the facility. */
const IN_PERSON_TYPES = new Set(["resident_visit", "volunteer_visit", "program", "facility_discovery_visit", "food_delivery"]);

const cap = (value: string | null) => (value ? capitalizeWords(value) : null);
const letters = (value: string | null) => (value ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** Edit distance between two short names (insert/delete/swap a letter). */
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** "Rifka" vs "Rivka", "Rosalyn" vs "Roslyn": the same name give or
 * take a typo. Very short names must match exactly. */
function closeName(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  return shorter >= 4 && distance(a, b) <= (shorter >= 7 ? 2 : 1);
}

/** Someone already in the CRM who is probably the "new" resident: a
 * close first name at the same facility, with no conflicting last name
 * (or, with no first name given, a close last name there). */
export function likelyExisting(
  newResident: { first_name: string | null; last_name: string | null },
  facilityId: string,
  existing: Directory["residents"]
) {
  const first = letters(newResident.first_name);
  const last = letters(newResident.last_name);
  return existing.filter((r) => {
    if (r.facility_id !== facilityId) return false;
    const rFirst = letters(r.first_name);
    const rLast = letters(r.last_name);
    const lastFits = !last || !rLast || closeName(last, rLast);
    if (first) return closeName(first, rFirst) && lastFits;
    return !!last && closeName(last, rLast);
  });
}

/** Swaps every directory alias in the model's plan for the real ID (and
 * every "NR1"/"NC1" key for "new:NR1"), checking each alias is the right
 * kind of record for where it's used. Anything that doesn't check out
 * is dropped and turned into a question, never guessed at. */
export function resolvePlan(
  model: ModelPlan,
  directory: Directory
): { plan: Plan; names: PlanNames; matches: PossibleMatches } {
  const names: PlanNames = {};
  const matches: PossibleMatches = {};
  const questions = [...model.questions];
  const newFacilityKeys = new Set(model.new_facilities.map((f) => f.key));
  const newResidentKeys = new Set(model.new_residents.map((r) => r.key));
  const newContactKeys = new Set(model.new_contacts.map((c) => c.key));

  for (const f of model.new_facilities) names[`new:${f.key}`] = `${capitalizeWords(f.name)} (new)`;

  for (const r of model.new_residents) names[`new:${r.key}`] = `${residentName({ first_name: cap(r.first_name), last_name: cap(r.last_name) })} (new)`;
  for (const c of model.new_contacts) names[`new:${c.key}`] = `${capitalizeWords(c.name)} (new)`;

  type Kind = "facility" | "resident" | "contact" | "staff";
  const prefix: Record<Kind, string> = { facility: "F", resident: "R", contact: "C", staff: "S" };

  // Returns the resolved ref, null for "none", or undefined if it was
  // given but doesn't check out.
  const resolve = (alias: string | null, kind: Kind): string | null | undefined => {
    if (alias === null || alias === "") return null;
    if (kind === "facility" && newFacilityKeys.has(alias)) return `new:${alias}`;
    if (kind === "resident" && newResidentKeys.has(alias)) return `new:${alias}`;
    if (kind === "contact" && newContactKeys.has(alias)) return `new:${alias}`;
    if (!alias.startsWith(prefix[kind])) return undefined;
    const id = directory.idFor.get(alias);
    if (!id) return undefined;
    names[id] = directory.nameFor.get(id) ?? alias;
    return id;
  };

  const unresolved = (what: string) => questions.push(`I couldn't match ${what} to a record, so I left it out.`);

  const plan: Plan = {
    summary: model.summary,
    new_facilities: model.new_facilities.map((f) => ({ ...f, name: capitalizeWords(f.name.trim()) })),
    new_residents: [],
    new_contacts: [],
    resident_updates: [],
    transfers: [],
    facility_updates: [],
    profile_notes: [],
    interactions: [],
    tasks: [],
    questions,
  };

  for (const r of model.new_residents) {
    const who = residentName({ first_name: cap(r.first_name), last_name: cap(r.last_name) });
    if (!r.first_name && !r.last_name) {
      questions.push("A new resident had no name at all, so I left them out. What is their first or last name?");
      continue;
    }
    const facility = resolve(r.facility, "facility");
    if (!facility) {
      unresolved(`the facility for new resident ${who}`);
      continue;
    }
    // Shown on the new-resident card, which then asks "same person or
    // someone new?" before anything can be saved.
    const found = likelyExisting(r, facility, directory.residents);
    if (found.length) {
      matches[r.key] = found.map((m) => ({ id: m.id, name: residentName(m) }));
      for (const m of found) names[m.id] = residentName(m);
    }
    if (!r.last_name) {
      questions.push(`${who} will be added without a last name -- add it to their profile when you learn it.`);
    }
    plan.new_residents.push({ ...r, first_name: cap(r.first_name), last_name: cap(r.last_name), facility });
  }
  const keptResidents = new Set(plan.new_residents.map((r) => r.key));

  for (const c of model.new_contacts) {
    const resident = resolve(c.resident, "resident");
    const facility = resolve(c.facility, "facility");
    if (resident === undefined || facility === undefined || (resident?.startsWith("new:") && !keptResidents.has(resident.slice(4)))) {
      unresolved(`who ${c.name} is connected to`);
      continue;
    }
    plan.new_contacts.push({ ...c, name: capitalizeWords(c.name), resident, facility });
  }
  const keptContacts = new Set(plan.new_contacts.map((c) => c.key));
  // A reference to a new person who was dropped above is as good as unresolved.
  const stillThere = (ref: string | null | undefined) =>
    ref === undefined
      ? undefined
      : ref?.startsWith("new:") && !keptResidents.has(ref.slice(4)) && !keptContacts.has(ref.slice(4))
        ? undefined
        : ref;

  for (const u of model.resident_updates) {
    const resident = stillThere(resolve(u.resident, "resident"));
    if (!resident || resident.startsWith("new:")) {
      unresolved(`the resident for a profile update`);
      continue;
    }
    plan.resident_updates.push({ ...u, resident });
  }

  for (const t of model.transfers) {
    const resident = resolve(t.resident, "resident");
    const newFacility = resolve(t.new_facility, "facility");
    if (!resident || resident.startsWith("new:") || !newFacility) {
      unresolved(`a resident's move to another facility`);
      continue;
    }
    plan.transfers.push({ ...t, resident, new_facility: newFacility });
  }

  for (const u of model.facility_updates) {
    const facility = resolve(u.facility, "facility");
    // A new facility's details go on the new facility itself.
    if (!facility || facility.startsWith("new:")) {
      unresolved(`the facility for a facility update`);
      continue;
    }
    plan.facility_updates.push({ ...u, facility });
  }

  for (const n of model.profile_notes) {
    const resident = stillThere(resolve(n.resident, "resident"));
    const facility = resolve(n.facility, "facility");
    if (resident === undefined || facility === undefined || !!resident === !!facility || !n.note.trim()) {
      unresolved(`who a profile note was about`);
      continue;
    }
    plan.profile_notes.push({ resident, facility, note: n.note.trim() });
  }

  for (const i of model.interactions) {
    const facility = resolve(i.facility, "facility");
    const resident = stillThere(resolve(i.resident, "resident"));
    const contact = stillThere(resolve(i.contact, "contact"));
    const volunteers = i.volunteers.map((v) => stillThere(resolve(v, "contact")));
    // The writer themselves is never "also" -- they log it anyway.
    const alsoBy = [...new Set(i.also_by.filter((a) => a !== directory.selfAlias).map((a) => resolve(a, "staff")))];
    if (alsoBy.some((a) => !a)) {
      questions.push(`Someone listed as also at the ${i.interaction_type.replace(/_/g, " ")} isn't a CRM user, so it isn't logged for them.`);
    }
    if (facility === undefined || resident === undefined || contact === undefined || volunteers.some((v) => !v)) {
      unresolved(`someone in the ${i.interaction_type.replace(/_/g, " ")} entry`);
      continue;
    }
    if (!orgLocalToIso(i.occurred_at)) {
      questions.push(`I couldn't work out when the ${i.interaction_type.replace(/_/g, " ")} happened, so I left it out.`);
      continue;
    }
    // Something can't have happened in the future: make the person check it.
    const inFuture = i.occurred_at.slice(0, 16) > toOrgDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    // A delivery is one delivery, however many staff were there -- it's a
    // byproduct of the visit, so only the writer logs it (director, Oct 7).
    const shared = i.interaction_type === "food_delivery" ? [] : alsoBy.filter((a): a is string => !!a);
    plan.interactions.push({
      ...i,
      date_unclear: i.date_unclear ?? (inFuture ? "This date is in the future." : null),
      facility,
      resident,
      contact,
      volunteers: volunteers as string[],
      also_by: shared,
    });
  }

  // Resident visits, programs and the like already count as visiting the
  // facility that day, so a separate "facility visit" would count it twice.
  const visitedThatDay = new Set(
    plan.interactions
      .filter((x) => IN_PERSON_TYPES.has(x.interaction_type) && x.facility)
      .map((x) => `${x.facility}|${x.occurred_at.slice(0, 10)}`)
  );
  plan.interactions = plan.interactions.filter((x) => {
    if (x.interaction_type !== "facility_visit" || !visitedThatDay.has(`${x.facility}|${x.occurred_at.slice(0, 10)}`)) return true;
    questions.push(
      `I didn't add a separate facility visit to ${names[x.facility!] ?? "the facility"} -- the visits logged there that day already count.`
    );
    return false;
  });

  for (const t of model.tasks) {
    const assigned = resolve(t.assigned_to, "staff");
    const resident = stillThere(resolve(t.resident, "resident"));
    const facility = resolve(t.facility, "facility");
    const contact = stillThere(resolve(t.contact, "contact"));
    if (assigned === undefined || resident === undefined || facility === undefined || contact === undefined) {
      unresolved(`part of the task "${t.title}"`);
      continue;
    }
    plan.tasks.push({ ...t, assigned_to: assigned, resident, facility, contact });
  }

  return { plan, names, matches };
}
