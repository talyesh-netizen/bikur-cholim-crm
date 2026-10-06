"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { HOLIDAY_TYPES, FAMILY_NEED_TYPES, SERVICE_FIELDS_BY_TYPE, occasionForHoliday, type InteractionType } from "@/lib/domain/interaction";
import { loadDirectory, type Directory } from "@/lib/assistant/directory";
import { resolvePlan } from "@/lib/assistant/resolve";
import { SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import {
  fromWire,
  planSchema,
  wirePlanSchema,
  type AnalyzeResult,
  type ApplyResult,
  type ApplyStep,
  type ModelPlan,
} from "@/lib/assistant/schema";
import { getLocalToday, orgLocalToIso, toOrgDatetimeLocalValue } from "@/lib/format-date";
import { capitalizeWords } from "@/lib/format-text";
import { notifyTaskAssigned } from "@/lib/notify-task-assigned";
import { residentName } from "@/lib/domain/resident-name";

const MODEL = "claude-opus-5";
const MAX_NOTE_LENGTH = 6000;

/**
 * Step 1 of Quick Log: read a free-form note and propose what to save.
 * Nothing is written to the database here -- the plan goes back to the
 * review screen, and only step 2 (applyPlan) saves anything.
 */
export async function analyzeNote(note: string): Promise<AnalyzeResult> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Please type or dictate a note first." };
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: "That note is too long for one go. Please split it into a few shorter notes." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "Quick Log isn't switched on yet: an admin needs to add the ANTHROPIC_API_KEY setting in Vercel.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  let directory: Directory;
  try {
    directory = await loadDirectory(supabase, user.id);
  } catch {
    return { ok: false, error: "Couldn't load the CRM's records just now. Please try again." };
  }

  const now = toOrgDatetimeLocalValue(new Date());
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" }).format(
    new Date()
  );

  let modelPlan: ModelPlan;
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(wirePlanSchema) },
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: `DIRECTORY\n\n${directory.text}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Current time in Cleveland: ${weekday}, ${now.replace("T", " ")}.\nThe person writing is ${
            directory.selfAlias ?? "a staff member"
          }.\n\nNOTE:\n${trimmed}`,
        },
      ],
    });

    const plan = response.stop_reason === "refusal" ? null : fromWire(response.parsed_output);
    if (!plan) {
      return { ok: false, error: "The assistant couldn't read that note. Please reword it, or use the regular forms." };
    }
    modelPlan = plan;
  } catch (error) {
    console.error("Quick Log: assistant request failed", error instanceof Anthropic.APIError ? error.status : "");
    return { ok: false, error: "The assistant is unavailable right now. Please try again in a minute." };
  }

  return { ok: true, ...resolvePlan(modelPlan, directory) };
}

/** Appends a dated line to an existing free-text field instead of
 * overwriting it, so nothing already written is ever lost. */
function appendNote(existing: string | null, addition: string, today: string) {
  const line = `[${today}] ${addition.trim()}`;
  if (existing?.includes(line)) return existing; // already added by an earlier save of this note
  return existing?.trim() ? `${existing.trim()}\n${line}` : line;
}

const blankToNull = (value: string | null) => (value?.trim() ? value.trim() : null);

/** Same letters, ignoring case, spacing and punctuation -- for spotting
 * that a "new" person from this note was already saved. */
const sameName = (a: string | null, b: string | null) =>
  (a ?? "").toLowerCase().replace(/[^\p{L}]/gu, "") === (b ?? "").toLowerCase().replace(/[^\p{L}]/gu, "");

/** A stable id for one logged interaction, built from what makes it
 * that interaction (who logged it, when, where, with whom, what kind),
 * so saving the same note twice -- or reading it again and saving --
 * hits the client_submission_id unique index instead of logging it
 * twice. The note text is left out on purpose: re-reading a note can
 * word the summary slightly differently. */
function quickLogSubmissionId(parts: (string | number | null)[]) {
  const h = createHash("sha256").update(`quick-log:${parts.map((p) => p ?? "").join("|")}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Step 2 of Quick Log: save a plan the staff member reviewed. Runs with
 * their own database connection, so the same access rules as every
 * other screen apply. Each piece is saved separately and reported back
 * one by one -- if one part fails, the rest still save, and the screen
 * says exactly which part didn't.
 */
export async function applyPlan(input: unknown): Promise<ApplyResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, steps: [{ label: "Nothing was saved: the plan looked wrong.", ok: false }] };
  const plan = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, steps: [{ label: "Nothing was saved: your session expired. Please sign in again.", ok: false }] };
  // Interns can't see or change private notes (the database ignores it too).
  const canWritePrivateNotes = (await getCurrentProfile())?.role !== "intern";

  const today = getLocalToday();
  const steps: ApplyStep[] = [];
  const newIds = new Map<string, string>();
  const touchedResidents = new Set<string>();
  const touchedFacilities = new Set<string>();

  // "new:NR1" -> the ID it was saved under (undefined if that save failed)
  const idOf = (ref: string | null): string | null | undefined =>
    ref === null ? null : ref.startsWith("new:") ? newIds.get(ref.slice(4)) : ref;

  const fail = (label: string, error = "Not saved -- please do this one by hand.") => steps.push({ label, ok: false, error });

  for (const r of plan.new_residents) {
    const label = `New resident: ${residentName(r)}`;
    // Saved already (e.g. this note was saved before)? Use that record.
    const { data: sameHere } = await supabase
      .from("residents")
      .select("id, first_name, last_name")
      .eq("current_facility_id", r.facility);
    const existing = (sameHere ?? []).find((x) => sameName(x.first_name, r.first_name) && sameName(x.last_name, r.last_name));
    if (existing) {
      newIds.set(r.key, existing.id);
      steps.push({ label: `${residentName(r)} is already in the CRM -- not added again`, ok: true, href: `/residents/${existing.id}` });
      continue;
    }
    const { data, error } = await supabase
      .from("residents")
      .insert({
        first_name: blankToNull(r.first_name) ? capitalizeWords(r.first_name!.trim()) : null,
        last_name: blankToNull(r.last_name) ? capitalizeWords(r.last_name!.trim()) : null,
        preferred_name: blankToNull(r.preferred_name),
        current_facility_id: r.facility,
        room_number: blankToNull(r.room_number),
        status: r.status,
        kosher_food_needs: blankToNull(r.kosher_food_needs),
        visitation_needs: blankToNull(r.visitation_needs),
        holiday_support_needs: blankToNull(r.holiday_support_needs),
        private_internal_notes: blankToNull(r.private_internal_notes),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      fail(label);
      continue;
    }
    newIds.set(r.key, data.id);
    touchedFacilities.add(r.facility);
    steps.push({ label, ok: true, href: `/residents/${data.id}` });
  }

  for (const c of plan.new_contacts) {
    const label = `New contact: ${capitalizeWords(c.name)}`;
    const residentId = idOf(c.resident);
    if (residentId === undefined) {
      fail(label, "Not saved, because the new resident they belong to wasn't saved.");
      continue;
    }
    const { data: sameNamed } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("contact_type", c.contact_type)
      .ilike("name", c.name.trim());
    const existingContact = (sameNamed ?? []).find((x) => sameName(x.name, c.name));
    const { data, error } = existingContact
      ? { data: { id: existingContact.id }, error: null }
      : await supabase
      .from("contacts")
      .insert({
        name: capitalizeWords(c.name.trim()),
        contact_type: c.contact_type,
        organization: blankToNull(c.organization),
        phone: blankToNull(c.phone),
        email: blankToNull(c.email),
        notes: blankToNull(c.notes),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      fail(label);
      continue;
    }
    newIds.set(c.key, data.id);

    let linkFailed = false;
    const alreadyLinked = async (table: "resident_contacts" | "facility_contacts", column: string, id: string) =>
      !!existingContact &&
      !!(await supabase.from(table).select("id").eq("contact_id", data.id).eq(column, id).eq("active", true).limit(1)).data?.length;
    if (residentId && !(await alreadyLinked("resident_contacts", "resident_id", residentId))) {
      const { error: linkError } = await supabase.from("resident_contacts").insert({
        resident_id: residentId,
        contact_id: data.id,
        relationship_to_resident: c.relationship_to_resident ?? "other",
        is_primary_contact: false,
        created_by: user.id,
      });
      linkFailed ||= !!linkError;
      touchedResidents.add(residentId);
    }
    if (c.facility && !(await alreadyLinked("facility_contacts", "facility_id", c.facility))) {
      const { error: linkError } = await supabase.from("facility_contacts").insert({
        facility_id: c.facility,
        contact_id: data.id,
        role_at_facility: blankToNull(c.role_at_facility),
        is_primary_contact: false,
        created_by: user.id,
      });
      linkFailed ||= !!linkError;
      touchedFacilities.add(c.facility);
    }
    steps.push(
      linkFailed
        ? { label, ok: false, href: `/contacts/${data.id}`, error: "Saved, but not linked to their resident/facility -- please link them by hand." }
        : existingContact
          ? { label: `${capitalizeWords(c.name)} is already in the CRM -- not added again`, ok: true, href: `/contacts/${data.id}` }
          : { label, ok: true, href: `/contacts/${data.id}` }
    );
  }

  for (const u of plan.resident_updates) {
    // Read through resident_summary, which always carries the resident's
    // current private notes (stored separately; see 20261005000002), so
    // appending never starts from a blank and overwrites them.
    const { data: current, error: readError } = await supabase
      .from("resident_summary")
      .select("first_name, last_name, preferred_name, kosher_food_needs, visitation_needs, holiday_support_needs, private_internal_notes")
      .eq("id", u.resident)
      .single();
    if (readError || !current) {
      fail("Update resident profile");
      continue;
    }
    const changes: Record<string, string> = {};
    if (u.status) changes.status = u.status;
    if (blankToNull(u.room_number)) changes.room_number = u.room_number!.trim();
    if (blankToNull(u.phone_number)) changes.phone_number = u.phone_number!.trim();
    if (blankToNull(u.add_to_kosher_food_needs)) changes.kosher_food_needs = appendNote(current.kosher_food_needs, u.add_to_kosher_food_needs!, today);
    if (blankToNull(u.add_to_visitation_needs)) changes.visitation_needs = appendNote(current.visitation_needs, u.add_to_visitation_needs!, today);
    if (blankToNull(u.add_to_holiday_support_needs)) changes.holiday_support_needs = appendNote(current.holiday_support_needs, u.add_to_holiday_support_needs!, today);
    if (canWritePrivateNotes && blankToNull(u.add_to_private_notes)) changes.private_internal_notes = appendNote(current.private_internal_notes, u.add_to_private_notes!, today);
    const who = residentName(current);
    const currentValues = current as Record<string, string | null>;
    for (const key of ["kosher_food_needs", "visitation_needs", "holiday_support_needs", "private_internal_notes"]) {
      if (key in changes && changes[key] === currentValues[key]) delete changes[key];
    }
    if (Object.keys(changes).length === 0) continue;
    const { data: updated, error } = await supabase.from("residents").update(changes).eq("id", u.resident).select("id");
    if (error || !updated?.length) {
      fail(`Update profile: ${who}`);
      continue;
    }
    touchedResidents.add(u.resident);
    steps.push({ label: `Update profile: ${who}`, ok: true, href: `/residents/${u.resident}` });
  }

  for (const t of plan.transfers) {
    const label = "Move resident to another facility";
    const { error } = await supabase.rpc("transfer_resident", {
      p_resident_id: t.resident,
      p_new_facility_id: t.new_facility,
      p_reason: blankToNull(t.reason),
      p_notes: null,
    });
    if (error && /already at this facility/i.test(error.message)) {
      steps.push({ label: "Already at that facility -- no move needed", ok: true, href: `/residents/${t.resident}` });
      continue;
    }
    if (error) {
      fail(label, "Not saved -- please use \"Move to another facility\" on their page.");
      continue;
    }
    touchedResidents.add(t.resident);
    touchedFacilities.add(t.new_facility);
    steps.push({ label, ok: true, href: `/residents/${t.resident}` });
  }

  for (const u of plan.facility_updates) {
    const { data: current, error: readError } = await supabase
      .from("facilities")
      .select("name, notes")
      .eq("id", u.facility)
      .single();
    if (readError || !current) {
      fail("Update facility");
      continue;
    }
    const changes: Record<string, string> = {};
    if (u.engagement_status) changes.engagement_status = u.engagement_status;
    if (u.visit_priority) changes.visit_priority = u.visit_priority;
    if (u.kosher_food_availability) changes.kosher_food_availability = u.kosher_food_availability;
    if (blankToNull(u.main_phone)) changes.main_phone = u.main_phone!.trim();
    if (blankToNull(u.add_to_notes)) changes.notes = appendNote(current.notes, u.add_to_notes!, today);
    if (changes.notes === current.notes) delete changes.notes;
    if (Object.keys(changes).length === 0) continue;
    const label = `Update facility: ${current.name}`;
    const { data: updated, error } = await supabase.from("facilities").update(changes).eq("id", u.facility).select("id");
    if (error || !updated?.length) {
      fail(label);
      continue;
    }
    touchedFacilities.add(u.facility);
    steps.push({ label, ok: true, href: `/facilities/${u.facility}` });
  }

  const interactionIds: string[] = [];
  for (const i of plan.interactions) {
    const label = `Log: ${i.interaction_type.replace(/_/g, " ")}`;
    const residentId = idOf(i.resident);
    const contactId = idOf(i.contact);
    const volunteerIds = i.volunteers.map(idOf);
    const occurredAt = orgLocalToIso(i.occurred_at);
    if (residentId === undefined || contactId === undefined || volunteerIds.some((v) => !v) || !occurredAt) {
      fail(label, "Not saved, because someone it depends on wasn't saved.");
      continue;
    }
    const { data, error } = await supabase
      .from("interactions")
      .insert({
        interaction_type: i.interaction_type,
        occurred_at: occurredAt,
        facility_id: i.facility,
        resident_id: residentId,
        contact_id: contactId,
        notes: blankToNull(i.notes),
        minutes_spent: i.minutes_spent && i.minutes_spent > 0 ? i.minutes_spent : null,
        people_reached:
          i.people_reached && i.people_reached > 0 && SERVICE_FIELDS_BY_TYPE[i.interaction_type as InteractionType]?.includes("people_reached")
            ? i.people_reached
            : null,
        holiday: i.holiday && HOLIDAY_TYPES.includes(i.interaction_type) ? i.holiday : null,
        family_need: i.family_need && FAMILY_NEED_TYPES.includes(i.interaction_type) ? i.family_need : null,
        occasion:
          i.holiday && HOLIDAY_TYPES.includes(i.interaction_type) && SERVICE_FIELDS_BY_TYPE[i.interaction_type as InteractionType]?.includes("occasion")
            ? occasionForHoliday(i.holiday)
            : null,
        staff_member_id: user.id,
        client_submission_id: quickLogSubmissionId([
          user.id, i.interaction_type, occurredAt, i.facility, residentId, contactId, i.holiday, i.family_need,
          i.people_reached && i.people_reached > 0 ? i.people_reached : null,
        ]),
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      steps.push({ label: `${label} -- already saved earlier, not added again`, ok: true, href: residentId ? `/residents/${residentId}` : i.facility ? `/facilities/${i.facility}` : "/interactions" });
      continue;
    }
    if (error || !data) {
      fail(label);
      continue;
    }
    interactionIds.push(data.id);
    if (volunteerIds.length > 0) {
      const { error: volunteerError } = await supabase.rpc("set_interaction_volunteers", {
        p_interaction_id: data.id,
        p_contact_ids: volunteerIds,
      });
      if (volunteerError) {
        steps.push({ label, ok: false, href: `/interactions/${data.id}/edit`, error: "Saved, but the volunteers weren't tagged -- please add them." });
        continue;
      }
    }
    if (residentId) touchedResidents.add(residentId);
    if (i.facility) touchedFacilities.add(i.facility);
    steps.push({ label, ok: true, href: residentId ? `/residents/${residentId}` : i.facility ? `/facilities/${i.facility}` : "/interactions" });
  }

  for (const t of plan.tasks) {
    const label = `Task: ${t.title}`;
    const residentId = idOf(t.resident);
    if (residentId === undefined) {
      fail(label, "Not saved, because the new resident it's about wasn't saved.");
      continue;
    }
    const dueDate = t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null;
    // The same open task saved from an earlier save of this note?
    let sameTask = supabase
      .from("tasks")
      .select("id")
      .eq("title", t.title.trim())
      .eq("assigned_to", t.assigned_to ?? user.id)
      .in("status", ["open", "in_progress", "waiting"]);
    sameTask = residentId ? sameTask.eq("resident_id", residentId) : sameTask.is("resident_id", null);
    sameTask = dueDate ? sameTask.eq("due_date", dueDate) : sameTask.is("due_date", null);
    if ((await sameTask.limit(1)).data?.length) {
      steps.push({ label: `${label} -- already on the task list, not added again`, ok: true, href: "/tasks" });
      continue;
    }
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: t.title.trim(),
        description: blankToNull(t.description),
        due_date: dueDate,
        priority: t.priority,
        task_category: t.task_category,
        assigned_to: t.assigned_to ?? user.id,
        resident_id: residentId,
        facility_id: t.facility,
        // Tie it to the visit it came from when this note logged exactly one.
        interaction_id: interactionIds.length === 1 ? interactionIds[0] : null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      fail(label);
      continue;
    }
    await notifyTaskAssigned(supabase, data.id, user.id);
    steps.push({ label, ok: true, href: "/tasks" });
  }

  revalidatePath("/dashboard");
  revalidatePath("/interactions");
  revalidatePath("/tasks");
  revalidatePath("/residents");
  revalidatePath("/contacts");
  revalidatePath("/facilities");
  for (const id of touchedResidents) revalidatePath(`/residents/${id}`);
  for (const id of touchedFacilities) revalidatePath(`/facilities/${id}`);

  if (steps.length === 0) steps.push({ label: "There was nothing to save.", ok: true });
  return { ok: steps.every((s) => s.ok), steps };
}
