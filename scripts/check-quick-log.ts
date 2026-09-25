/**
 * Offline check of the Quick Log plumbing (no API call, no database):
 * feeds a hand-written "Claude answer" through the same wire-format
 * conversion and alias resolution the live feature uses, and prints the
 * result. Run with: npx tsx scripts/check-quick-log.ts
 */
import { fromWire, planSchema, wirePlanSchema } from "../src/lib/assistant/schema";
import { resolvePlan } from "../src/lib/assistant/resolve";
import { SYSTEM_PROMPT } from "../src/lib/assistant/prompt";
import { z } from "zod";

const ids = {
  F1: "11111111-1111-4111-8111-111111111111",
  R1: "22222222-2222-4222-8222-222222222222",
  C1: "33333333-3333-4333-8333-333333333333",
  S1: "44444444-4444-4444-8444-444444444444",
};
const directory = {
  text: "",
  idFor: new Map(Object.entries(ids)),
  nameFor: new Map([
    [ids.F1, "Menorah Park"],
    [ids.R1, "Rivka Cohen"],
    [ids.C1, "Dovid Klein"],
    [ids.S1, "Rabbi Test"],
  ]),
  selfAlias: "S1",
};

const wire = {
  summary: "Visit with Rivka Cohen; her daughter Sarah is new.",
  new_residents: [],
  new_contacts: [
    { key: "NC1", name: "sarah levine", contact_type: "family_member", organization: "", phone: "216-555-0142", email: "", notes: "",
      resident: "R1", relationship_to_resident: "daughter", facility: "", role_at_facility: "" },
  ],
  resident_updates: [
    { resident: "R1", status: "", room_number: "212", phone_number: "", add_to_kosher_food_needs: "Grape juice for Shabbos",
      add_to_visitation_needs: "", add_to_holiday_support_needs: "", add_to_private_notes: "" },
  ],
  transfers: [],
  facility_updates: [],
  interactions: [
    { interaction_type: "resident_visit", occurred_at: "2026-09-25T15:00", facility: "F1", resident: "R1", contact: "",
      volunteers: [], notes: "Friendly visit; moved to room 212.", minutes_spent: 45 },
    { interaction_type: "family_communication", occurred_at: "2026-09-25T15:30", facility: "F1", resident: "R1", contact: "NC1",
      volunteers: ["C99"], notes: "", minutes_spent: 0 },
  ],
  tasks: [
    { title: "Bring grape juice", description: "", due_date: "2026-09-25", priority: "medium", task_category: "kosher_food",
      assigned_to: "", resident: "R1", facility: "F1" },
  ],
  questions: [],
};

const wireOk = wirePlanSchema.safeParse(wire);
console.log("wire schema accepts sample:", wireOk.success);
const jsonSchema = JSON.stringify(z.toJSONSchema(wirePlanSchema));
console.log("wire JSON schema has anyOf:", jsonSchema.includes("anyOf"), "| size:", jsonSchema.length, "chars");
console.log("system prompt length:", SYSTEM_PROMPT.length, "chars");

const model = fromWire(wire);
if (!model) throw new Error("fromWire rejected the sample");
const { plan, names } = resolvePlan(model, directory);
console.log("resolved plan valid:", planSchema.safeParse(plan).success);
console.log(JSON.stringify({ plan, names }, null, 2));
