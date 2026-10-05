"use server";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
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
  return existing?.trim() ? `${existing.trim()}\n${line}` : line;
}

const blankToNull = (value: string | null) => (value?.trim() ? value.trim() : null);

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
    const label = `New resident: ${capitalizeWords(r.first_name)} ${capitalizeWords(r.last_name)}`.replace(/\s+/g, " ").trim();
    const { data, error } = await supabase
      .from("residents")
      .insert({
        first_name: blankToNull(r.first_name) ? capitalizeWords(r.first_name.trim()) : null,
        last_name: blankToNull(r.last_name) ? capitalizeWords(r.last_name.trim()) : null,
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
    const { data, error } = await supabase
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
    if (residentId) {
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
    if (c.facility) {
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
        staff_member_id: user.id,
      })
      .select("id")
      .single();
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
