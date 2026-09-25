import type { Directory } from "@/lib/assistant/directory";
import type { ModelPlan, Plan, PlanNames } from "@/lib/assistant/schema";
import { orgLocalToIso } from "@/lib/format-date";
import { capitalizeWords } from "@/lib/format-text";

/** Swaps every directory alias in the model's plan for the real ID (and
 * every "NR1"/"NC1" key for "new:NR1"), checking each alias is the right
 * kind of record for where it's used. Anything that doesn't check out
 * is dropped and turned into a question, never guessed at. */
export function resolvePlan(model: ModelPlan, directory: Directory): { plan: Plan; names: PlanNames } {
  const names: PlanNames = {};
  const questions = [...model.questions];
  const newResidentKeys = new Set(model.new_residents.map((r) => r.key));
  const newContactKeys = new Set(model.new_contacts.map((c) => c.key));

  for (const r of model.new_residents) names[`new:${r.key}`] = `${capitalizeWords(r.first_name)} ${capitalizeWords(r.last_name)} (new)`;
  for (const c of model.new_contacts) names[`new:${c.key}`] = `${capitalizeWords(c.name)} (new)`;

  type Kind = "facility" | "resident" | "contact" | "staff";
  const prefix: Record<Kind, string> = { facility: "F", resident: "R", contact: "C", staff: "S" };

  // Returns the resolved ref, null for "none", or undefined if it was
  // given but doesn't check out.
  const resolve = (alias: string | null, kind: Kind): string | null | undefined => {
    if (alias === null || alias === "") return null;
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
    new_residents: [],
    new_contacts: [],
    resident_updates: [],
    transfers: [],
    facility_updates: [],
    interactions: [],
    tasks: [],
    questions,
  };

  for (const r of model.new_residents) {
    const facility = resolve(r.facility, "facility");
    if (!facility) {
      unresolved(`the facility for new resident ${r.first_name} ${r.last_name}`);
      continue;
    }
    plan.new_residents.push({ ...r, first_name: capitalizeWords(r.first_name), last_name: capitalizeWords(r.last_name), facility });
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
    if (!facility) {
      unresolved(`the facility for a facility update`);
      continue;
    }
    plan.facility_updates.push({ ...u, facility });
  }

  for (const i of model.interactions) {
    const facility = resolve(i.facility, "facility");
    const resident = stillThere(resolve(i.resident, "resident"));
    const contact = stillThere(resolve(i.contact, "contact"));
    const volunteers = i.volunteers.map((v) => stillThere(resolve(v, "contact")));
    if (facility === undefined || resident === undefined || contact === undefined || volunteers.some((v) => !v)) {
      unresolved(`someone in the ${i.interaction_type.replace(/_/g, " ")} entry`);
      continue;
    }
    if (!orgLocalToIso(i.occurred_at)) {
      questions.push(`I couldn't work out when the ${i.interaction_type.replace(/_/g, " ")} happened, so I left it out.`);
      continue;
    }
    plan.interactions.push({ ...i, facility, resident, contact, volunteers: volunteers as string[] });
  }

  for (const t of model.tasks) {
    const assigned = resolve(t.assigned_to, "staff");
    const resident = stillThere(resolve(t.resident, "resident"));
    const facility = resolve(t.facility, "facility");
    if (assigned === undefined || resident === undefined || facility === undefined) {
      unresolved(`part of the task "${t.title}"`);
      continue;
    }
    plan.tasks.push({ ...t, assigned_to: assigned, resident, facility });
  }

  return { plan, names };
}
