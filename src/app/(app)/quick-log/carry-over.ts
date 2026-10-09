import type { Plan, PlanNames } from "@/lib/assistant/schema";

type Section = keyof Omit<Plan, "summary" | "questions">;
const SECTIONS: Section[] = [
  "new_facilities", "new_residents", "new_contacts", "resident_updates", "transfers",
  "facility_updates", "profile_notes", "interactions", "tasks",
];

/** The person's choices on the check screen, carried from one reading of
 * a note to the next when they add to it (decided Oct 9, 2026), so adding
 * a sentence never wipes what they already fixed. */
export type CheckChoices = {
  skipped: Set<string>;
  decisions: Record<string, string>;
  dateFixes: Record<number, string>;
  repeatAnswers: Record<number, "second" | "same">;
  /** `${section}:${index}` of cards changed with Edit. */
  edited: Set<string>;
};

const low = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? "");

/** What makes an entry "the same one" across two readings. */
function signature(section: Section, item: Record<string, unknown>): string {
  const pick = (...keys: string[]) => JSON.stringify(keys.map((k) => low(item[k])));
  switch (section) {
    case "interactions":
      return pick("interaction_type", "resident", "contact", "facility") + String(item.occurred_at ?? "").slice(0, 10);
    case "tasks":
      return pick("title", "resident", "facility");
    case "profile_notes":
      return pick("resident", "facility", "note");
    case "new_residents":
      return pick("first_name", "last_name");
    case "new_contacts":
    case "new_facilities":
      return pick("name");
    case "transfers":
      return pick("resident", "new_facility");
    case "resident_updates":
      return pick("resident");
    case "facility_updates":
      return pick("facility");
  }
}

/**
 * Matches each entry of the new reading to the same entry in the old one
 * (as the assistant first proposed it) and carries over what the person
 * did to it: unticked, edited, date confirmed, "second visit?" answered,
 * "same person?" answered. Entries that are new get no carried choices.
 */
export function carryOver(
  old: { original: Plan; plan: Plan; names: PlanNames; choices: CheckChoices },
  next: { plan: Plan; names: PlanNames }
): { plan: Plan; choices: CheckChoices } {
  const choices: CheckChoices = { skipped: new Set(), decisions: {}, dateFixes: {}, repeatAnswers: {}, edited: new Set() };
  const plan = { ...next.plan } as Plan;
  for (const section of SECTIONS) {
    const before = old.original[section] as unknown as Record<string, unknown>[];
    const used = new Set<number>();
    const list = [...(next.plan[section] as unknown as Record<string, unknown>[])];
    list.forEach((item, j) => {
      const sig = signature(section, item);
      const i = before.findIndex((b, k) => !used.has(k) && signature(section, b) === sig);
      if (i < 0) return;
      used.add(i);
      const from = `${section}:${i}`;
      const to = `${section}:${j}`;
      if (old.choices.skipped.has(from)) choices.skipped.add(to);
      if (old.choices.edited.has(from)) {
        list[j] = (old.plan[section] as unknown as Record<string, unknown>[])[i];
        choices.edited.add(to);
      }
      if (section === "interactions") {
        if (old.choices.dateFixes[i]) choices.dateFixes[j] = old.choices.dateFixes[i];
        if (old.choices.repeatAnswers[i]) choices.repeatAnswers[j] = old.choices.repeatAnswers[i];
      }
    });
    (plan as Record<string, unknown>)[section] = list;
  }
  // "Same person?" answers follow the new person's name.
  for (const [key, choice] of Object.entries(old.choices.decisions)) {
    const name = old.names[`new:${key}`];
    const match = Object.entries(next.names).find(([ref, n]) => ref.startsWith("new:") && n === name);
    if (match) choices.decisions[match[0].slice(4)] = choice;
  }
  return { plan, choices };
}
