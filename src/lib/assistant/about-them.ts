import type { Plan } from "@/lib/assistant/schema";

/** Lasting needs -- kosher food, holidays, visiting -- go in "About
 * them" as labelled notes (decided Oct 9, 2026: one place for notes
 * about a person), not the old separate boxes the page no longer shows. */
export function aboutThemNotes(plan: Plan): Plan {
  const extra: Plan["profile_notes"] = [];
  const label = { kosher: "Kosher food", holiday: "Holidays", visiting: "Visiting" } as const;
  const add = (resident: string, kind: keyof typeof label, text: string | null | undefined) => {
    if (text?.trim()) extra.push({ resident, facility: null, note: `${label[kind]}: ${text.trim()}` });
  };
  const new_residents = plan.new_residents.map((r) => {
    add(`new:${r.key}`, "kosher", r.kosher_food_needs);
    add(`new:${r.key}`, "holiday", r.holiday_support_needs);
    add(`new:${r.key}`, "visiting", r.visitation_needs);
    return { ...r, kosher_food_needs: null, holiday_support_needs: null, visitation_needs: null };
  });
  const resident_updates = plan.resident_updates.map((u) => {
    add(u.resident, "kosher", u.add_to_kosher_food_needs);
    add(u.resident, "holiday", u.add_to_holiday_support_needs);
    add(u.resident, "visiting", u.add_to_visitation_needs);
    return { ...u, add_to_kosher_food_needs: null, add_to_holiday_support_needs: null, add_to_visitation_needs: null };
  });
  return { ...plan, new_residents, resident_updates, profile_notes: [...plan.profile_notes, ...extra] };
}
