/**
 * The shapes the Quick Log assistant works with.
 *
 * Two versions of the same plan:
 *
 * - `modelPlanSchema` is what Claude fills in. It refers to existing
 *   records by short aliases ("F12", "R40", "C7", "S2") from the
 *   directory it was given, and to people it is proposing to create by
 *   keys like "NR1" / "NC1" -- never by database IDs, so it can't
 *   invent an ID that happens to point somewhere real.
 * - `planSchema` is the same plan after the server has swapped every
 *   alias for the real ID (see lib/actions/assistant.ts). This is what
 *   the review screen shows and what gets sent back to be saved -- and
 *   it is re-validated on the way back in, since it round-trips through
 *   the browser.
 *
 * Every field is required-but-nullable rather than optional: structured
 * outputs need every key present, and "null" is an explicit "nothing
 * said about this", which is easier to reason about than a missing key.
 */

import { z } from "zod";
import { INTERACTION_TYPES, HOLIDAYS, FAMILY_NEEDS } from "@/lib/domain/interaction";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { CONTACT_TYPES, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { ENGAGEMENT_STATUSES, VISIT_PRIORITIES, KOSHER_FOOD_OPTIONS, FACILITY_TYPES } from "@/lib/domain/facility";
import { TASK_CATEGORIES, TASK_PRIORITIES } from "@/lib/domain/task";

const values = (options: readonly { value: string }[]) => options.map((o) => o.value) as [string, ...string[]];

const enumOf = (options: readonly { value: string }[]) => ({
  /** On the wire to Claude: "" means "nothing said". */
  wire: z.enum([...values(options), ""]),
  plain: z.enum(values(options)),
});

type EnumPair = ReturnType<typeof enumOf>;

const interactionType = enumOf(INTERACTION_TYPES);
const holiday = enumOf(HOLIDAYS);
const familyNeed = enumOf(FAMILY_NEEDS);
const residentStatus = enumOf(RESIDENT_STATUSES);
const contactType = enumOf(CONTACT_TYPES);
const relationship = enumOf(RESIDENT_CONTACT_RELATIONSHIPS);
const engagementStatus = enumOf(ENGAGEMENT_STATUSES);
const visitPriority = enumOf(VISIT_PRIORITIES);
const kosherFood = enumOf(KOSHER_FOOD_OPTIONS);
const facilityType = enumOf(FACILITY_TYPES);
const taskCategory = enumOf(TASK_CATEGORIES);
const taskPriority = enumOf(TASK_PRIORITIES);

/**
 * Builds every version of the plan schema from one description, so they
 * can't drift apart. `ref` is how an existing-or-new record is referred
 * to. In `wire` mode (what Claude fills in) "none" is an empty string /
 * zero rather than null -- that keeps the schema free of either-or
 * types, which structured outputs handle best; `fromWire` below turns
 * those back into nulls straight away.
 */
function buildPlanSchema<Ref extends z.ZodType>(ref: Ref, wire: boolean) {
  const text = wire ? z.string() : z.string().nullable();
  const maybe = <T extends z.ZodType>(schema: T) => (wire ? schema : schema.nullable());
  const choice = (e: EnumPair) => (wire ? e.wire : e.plain.nullable());
  const required = (e: EnumPair) => e.plain;
  const optionalRef = wire ? z.string() : ref.nullable();

  return z.object({
    summary: z.string(),
    /** A place the note names that isn't in the CRM yet ("NF1"...). */
    new_facilities: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        facility_type: required(facilityType),
        city: text,
        address: text,
        notes: text,
      })
    ),
    new_residents: z.array(
      z.object({
        key: z.string(),
        // At least one of the two (checked in resolve.ts) -- the CRM
        // allows a resident known only by first name, like "Rivka".
        first_name: text,
        last_name: text,
        preferred_name: text,
        facility: ref,
        room_number: text,
        status: required(residentStatus),
        kosher_food_needs: text,
        visitation_needs: text,
        holiday_support_needs: text,
        private_internal_notes: text,
      })
    ),
    new_contacts: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        contact_type: required(contactType),
        organization: text,
        phone: text,
        email: text,
        notes: text,
        resident: optionalRef,
        relationship_to_resident: choice(relationship),
        facility: optionalRef,
        role_at_facility: text,
      })
    ),
    resident_updates: z.array(
      z.object({
        resident: ref,
        status: choice(residentStatus),
        room_number: text,
        phone_number: text,
        add_to_kosher_food_needs: text,
        add_to_visitation_needs: text,
        add_to_holiday_support_needs: text,
        add_to_private_notes: text,
      })
    ),
    transfers: z.array(
      z.object({
        resident: ref,
        new_facility: ref,
        reason: text,
      })
    ),
    facility_updates: z.array(
      z.object({
        facility: ref,
        engagement_status: choice(engagementStatus),
        visit_priority: choice(visitPriority),
        kosher_food_availability: choice(kosherFood),
        main_phone: text,
        add_to_notes: text,
      })
    ),
    /** Lasting facts for a resident's or facility's Profile notes
     * timeline -- exactly one of resident / facility. */
    profile_notes: z.array(
      z.object({
        resident: optionalRef,
        facility: optionalRef,
        note: z.string(),
      })
    ),
    interactions: z.array(
      z.object({
        interaction_type: required(interactionType),
        occurred_at: z.string(),
        /** Why the date or time is uncertain ("Monday" when today is
         * Monday...); empty when the note made it clear. The review
         * screen makes the person confirm or fix the date first. */
        date_unclear: text,
        facility: optionalRef,
        resident: optionalRef,
        contact: optionalRef,
        volunteers: z.array(ref),
        /** Other staff (S aliases) who were there too ("visited with
         * Sara") -- each gets the same entry under their own name. */
        also_by: z.array(ref),
        notes: text,
        minutes_spent: maybe(z.number().int()),
        /** How many people a delivery, program or group visit reached. */
        people_reached: maybe(z.number().int()),
        holiday: choice(holiday),
        family_need: choice(familyNeed),
      })
    ),
    tasks: z.array(
      z.object({
        title: z.string(),
        description: text,
        due_date: text,
        priority: required(taskPriority),
        task_category: required(taskCategory),
        assigned_to: optionalRef,
        resident: optionalRef,
        facility: optionalRef,
        /** The person the follow-up is with ("call Michelle back"). */
        contact: optionalRef,
      })
    ),
    questions: z.array(z.string()),
  });
}

/** What Claude is asked to fill in. */
export const wirePlanSchema = buildPlanSchema(z.string(), true);

/** Claude's plan with "" / 0 turned back into null, aliases not yet resolved. */
export const modelPlanSchema = buildPlanSchema(z.string(), false);
export type ModelPlan = z.infer<typeof modelPlanSchema>;

/** Turns the wire format's "" and 0 placeholders into null. Every empty
 * string anywhere in the plan means "nothing", and for the only numbers
 * (minutes_spent, people_reached) 0 means "not said". */
export function fromWire(wirePlan: unknown): ModelPlan | null {
  const parsed = parseWire(wirePlan);
  return parsed.success ? parsed.data : null;
}

function parseWire(wirePlan: unknown) {
  const nullify = (value: unknown): unknown => {
    if (value === "" || value === 0) return null;
    if (Array.isArray(value)) return value.map(nullify).filter((v) => v !== null);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, nullify(v)]));
    }
    return typeof value === "string" ? value.trim() || null : value;
  };
  return modelPlanSchema.safeParse(nullify(wirePlan));
}

const describeIssues = (issues: z.core.$ZodIssue[]) =>
  issues
    .slice(0, 12)
    .map((i) => `${i.path.join(".") || "(top)"}: ${i.message}`)
    .join("; ");

/** The plan's JSON Schema, given to Claude in the instructions. (It used
 * to be enforced by the API's structured-output mode, but the plan grew
 * past that mode's size limit -- so now the reply is checked here.) */
export const PLAN_JSON_SCHEMA = JSON.stringify(z.toJSONSchema(wirePlanSchema));

const PLAN_LISTS = Object.keys(wirePlanSchema.shape).filter((k) => k !== "summary");

/** Reads Claude's text reply as a plan: finds the JSON object (ignoring
 * any stray prose or code fences), fills in lists it left out, and
 * checks every field. Says what's wrong when it doesn't fit, so Claude
 * can be asked to correct it. */
export function parsePlanText(text: string): { plan: ModelPlan } | { problem: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { problem: "There was no JSON object in the reply." };
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return { problem: `The JSON couldn't be read: ${error instanceof Error ? error.message : "invalid JSON"}.` };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { problem: "The reply wasn't a JSON object." };
  const filled: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  if (typeof filled.summary !== "string" || !filled.summary.trim()) filled.summary = "Here's what I found in your note.";
  for (const key of PLAN_LISTS) if (!Array.isArray(filled[key])) filled[key] = [];
  const wire = wirePlanSchema.safeParse(filled);
  if (!wire.success) return { problem: `Some fields didn't match the schema: ${describeIssues(wire.error.issues)}` };
  // "" means "nothing" -- so a required reference left as "" lands here.
  const plan = parseWire(wire.data);
  return plan.success
    ? { plan: plan.data }
    : { problem: `Some required fields were empty: ${describeIssues(plan.error.issues)}` };
}

/** After alias resolution: an existing record's real ID, or "new:NR1"
 * for someone this same plan creates. */
const resolvedRef = z.string().regex(/^([0-9a-f-]{36}|new:[A-Za-z0-9_-]+)$/i);
export const planSchema = buildPlanSchema(resolvedRef, false);
export type Plan = z.infer<typeof planSchema>;

/** Display names for every ID in a resolved plan, so the review screen
 * can say "Rivka Cohen at Menorah Park" instead of showing IDs. */
export type PlanNames = Record<string, string>;

/** For each proposed new resident (by key, e.g. "NR1"), existing
 * residents at the same facility with a near-identical name -- the
 * review screen makes the person choose before saving. */
export type PossibleMatches = Record<string, { id: string; name: string }[]>;

export type AnalyzeResult =
  | { ok: true; plan: Plan; names: PlanNames; matches: PossibleMatches }
  | { ok: false; error: string };

export type ApplyStep = { label: string; ok: boolean; href?: string; error?: string };
export type ApplyResult = { ok: boolean; steps: ApplyStep[] };
