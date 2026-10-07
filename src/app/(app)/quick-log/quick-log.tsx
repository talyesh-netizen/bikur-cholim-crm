"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  UserPlus,
  PencilLine,
  ArrowRightLeft,
  Building2,
  HeartHandshake,
  ListPlus,
  Loader2,
  StickyNote,
  CalendarClock,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { VoiceButton } from "@/components/voice-button";
import { residentName } from "@/lib/domain/resident-name";
import { analyzeNote, applyPlan } from "@/lib/actions/assistant";
import type { ApplyResult, Plan, PlanNames, PossibleMatches } from "@/lib/assistant/schema";
import { labelFor, INTERACTION_TYPES, HOLIDAYS, FAMILY_NEEDS } from "@/lib/domain/interaction";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { CONTACT_TYPES, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { ENGAGEMENT_STATUSES, VISIT_PRIORITIES, KOSHER_FOOD_OPTIONS, FACILITY_TYPES } from "@/lib/domain/facility";
import { TASK_CATEGORIES } from "@/lib/domain/task";
import { formatDateOnly, formatDateTimeWithTime, getLocalToday, orgLocalToIso } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type Section = keyof Omit<Plan, "summary" | "questions">;
type Item = {
  section: Section;
  index: number;
  icon: LucideIcon;
  title: string;
  lines: string[];
  /** Set on a new-resident card: its key, for the "same person?" choice. */
  newResidentKey?: string;
  /** Set on an interaction whose date the assistant wasn't sure of. */
  dateIssue?: string;
};
/** Per flagged new resident: "new", or the id of the existing resident it really is. */
type Decisions = Record<string, string>;
/** Per interaction (by index) whose date was unclear: the date the person confirmed. */
type DateFixes = Record<number, string>;

const EXAMPLE =
  "Just left Menorah Park. Saw Rivka Cohen for about 45 minutes, she moved to room 212. Remind me to call her daughter Sarah next week about Chanukah. Catching up from Monday: visited Bella at Montefiore, doing well.";

const ONSITE_EXAMPLE =
  "Saw Rivka Cohen, room 212, in good spirits. Moshe Feldman is new here after hip surgery and would love visitors. Follow up with the social worker about Bella's move to assisted living on the 15th.";

/** A field the person can correct on a review card (Edit). */
type EditField = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "date" | "datetime" | "number" | "select";
  options?: readonly { value: string; label: string }[];
};

const opt = (options: readonly { value: string; label: string }[]) => options;

/** What can be corrected on each kind of card -- the details people
 * actually get wrong (a spelling, a relationship, a date), not every
 * field. Anything else is fixed on the record after saving. */
function editFieldsFor(plan: Plan, section: Section, index: number): EditField[] {
  switch (section) {
    case "new_facilities":
      return [
        { key: "name", label: "Name" },
        { key: "facility_type", label: "Type", kind: "select", options: opt(FACILITY_TYPES) },
        { key: "city", label: "City" },
      ];
    case "new_residents":
      return [
        { key: "first_name", label: "First name" },
        { key: "last_name", label: "Last name" },
        { key: "room_number", label: "Room" },
        { key: "visitation_needs", label: "Visiting", kind: "textarea" },
      ];
    case "new_contacts": {
      const c = plan.new_contacts[index];
      return [
        { key: "name", label: "Name" },
        { key: "contact_type", label: "Who they are", kind: "select", options: opt(CONTACT_TYPES) },
        ...(c.resident
          ? [{ key: "relationship_to_resident", label: "Relationship", kind: "select" as const, options: opt(RESIDENT_CONTACT_RELATIONSHIPS) }]
          : []),
        ...(c.facility ? [{ key: "role_at_facility", label: "Role at the facility" }] : []),
        { key: "phone", label: "Phone" },
      ];
    }
    case "resident_updates":
      return [
        { key: "room_number", label: "Room" },
        { key: "phone_number", label: "Phone" },
      ];
    case "transfers":
      return [{ key: "reason", label: "Reason", kind: "textarea" }];
    case "facility_updates":
      return [{ key: "add_to_notes", label: "Note", kind: "textarea" }];
    case "profile_notes":
      return [{ key: "note", label: "Note", kind: "textarea" }];
    case "interactions":
      return [
        { key: "interaction_type", label: "Type", kind: "select", options: opt(INTERACTION_TYPES) },
        { key: "occurred_at", label: "When", kind: "datetime" },
        { key: "minutes_spent", label: "Minutes", kind: "number" },
        { key: "notes", label: "Notes", kind: "textarea" },
      ];
    case "tasks":
      return [
        { key: "title", label: "Follow-up" },
        { key: "due_date", label: "Due", kind: "date" },
        { key: "description", label: "Details", kind: "textarea" },
      ];
  }
}

/** Turns a plan into the plain-English cards shown for review. */
function describe(plan: Plan, names: PlanNames, today: string): Item[] {
  const n = (ref: string | null) => (ref ? names[ref] ?? "someone" : null);
  const items: Item[] = [];
  const add = (
    section: Section,
    index: number,
    icon: LucideIcon,
    title: string,
    lines: (string | null | false)[],
    newResidentKey?: string,
    dateIssue?: string
  ) => items.push({ section, index, icon, title, lines: lines.filter(Boolean) as string[], newResidentKey, dateIssue });

  plan.new_facilities.forEach((f, i) =>
    add("new_facilities", i, Building2, `Add new facility: ${f.name}`, [
      labelFor(FACILITY_TYPES, f.facility_type),
      [f.address, f.city].filter(Boolean).join(", ") || null,
      f.notes && `Note: ${f.notes}`,
    ])
  );
  plan.new_residents.forEach((r, i) =>
    add("new_residents", i, UserPlus, `Add new resident: ${residentName(r)}`, [
      `At ${n(r.facility)}${r.room_number ? `, room ${r.room_number}` : ""}`,
      r.status !== "active" && `Status: ${labelFor(RESIDENT_STATUSES, r.status)}`,
      r.kosher_food_needs && `Kosher food: ${r.kosher_food_needs}`,
      r.visitation_needs && `Visiting: ${r.visitation_needs}`,
      r.holiday_support_needs && `Holidays: ${r.holiday_support_needs}`,
      r.private_internal_notes && `Private note: ${r.private_internal_notes}`,
    ], r.key)
  );
  plan.new_contacts.forEach((c, i) =>
    add("new_contacts", i, UserPlus, `Add new contact: ${c.name}`, [
      labelFor(CONTACT_TYPES, c.contact_type),
      c.resident &&
        `${c.relationship_to_resident ? labelFor(RESIDENT_CONTACT_RELATIONSHIPS, c.relationship_to_resident) : "Contact"} of ${n(c.resident)}`,
      c.facility && `${c.role_at_facility ?? "Staff"} at ${n(c.facility)}`,
      c.organization && `Organization: ${c.organization}`,
      c.phone && `Phone: ${c.phone}`,
      c.email && `Email: ${c.email}`,
      c.notes && `Note: ${c.notes}`,
    ])
  );
  plan.resident_updates.forEach((u, i) =>
    add("resident_updates", i, PencilLine, `Update ${n(u.resident)}'s profile`, [
      u.status && `Status → ${labelFor(RESIDENT_STATUSES, u.status)}`,
      u.room_number && `Room → ${u.room_number}`,
      u.phone_number && `Phone → ${u.phone_number}`,
      u.add_to_kosher_food_needs && `Kosher food: + ${u.add_to_kosher_food_needs}`,
      u.add_to_visitation_needs && `Visiting: + ${u.add_to_visitation_needs}`,
      u.add_to_holiday_support_needs && `Holidays: + ${u.add_to_holiday_support_needs}`,
      u.add_to_private_notes && `Private note: + ${u.add_to_private_notes}`,
    ])
  );
  plan.transfers.forEach((t, i) =>
    add("transfers", i, ArrowRightLeft, `Move ${n(t.resident)} to ${n(t.new_facility)}`, [t.reason && `Reason: ${t.reason}`])
  );
  plan.facility_updates.forEach((u, i) =>
    add("facility_updates", i, Building2, `Update ${n(u.facility)}`, [
      u.engagement_status && `Engagement → ${labelFor(ENGAGEMENT_STATUSES, u.engagement_status)}`,
      u.visit_priority && `Visit priority → ${labelFor(VISIT_PRIORITIES, u.visit_priority)}`,
      u.kosher_food_availability && `Kosher food → ${labelFor(KOSHER_FOOD_OPTIONS, u.kosher_food_availability)}`,
      u.main_phone && `Main phone → ${u.main_phone}`,
      u.add_to_notes && `Notes: + ${u.add_to_notes}`,
    ])
  );
  plan.profile_notes.forEach((p, i) =>
    add("profile_notes", i, StickyNote, `Profile note for ${n(p.resident) ?? n(p.facility)}`, [p.note])
  );
  plan.interactions.forEach((x, i) => {
    const iso = orgLocalToIso(x.occurred_at);
    add("interactions", i, HeartHandshake, `Log: ${labelFor(INTERACTION_TYPES, x.interaction_type)}${x.holiday ? ` · ${labelFor(HOLIDAYS, x.holiday)}` : ""}${x.family_need ? ` · ${labelFor(FAMILY_NEEDS, x.family_need)}` : ""}`, [
      [n(x.resident), n(x.contact) && `with ${n(x.contact)}`, n(x.facility) && `at ${n(x.facility)}`].filter(Boolean).join(" "),
      // The date comes first: a past entry ("catching up from Monday")
      // must be visibly on the right day.
      iso && `${x.occurred_at.slice(0, 10) === today ? "Today" : "Earlier"} · ${formatDateTimeWithTime(iso)}`,
      x.volunteers.length > 0 && `Volunteers: ${x.volunteers.map(n).join(", ")}`,
      x.also_by.length > 0 && `Also logged for ${x.also_by.map(n).join(", ")} (they were there too)`,
      x.minutes_spent ? `${x.minutes_spent} minutes` : null,
      x.people_reached ? `${x.people_reached} ${x.people_reached === 1 ? "person" : "people"} reached` : null,
      x.notes,
    ], undefined, x.date_unclear ?? undefined);
  });
  plan.tasks.forEach((t, i) =>
    add("tasks", i, ListPlus, `Follow-up: ${t.title}`, [
      [labelFor(TASK_CATEGORIES, t.task_category), t.priority === "high" && "high priority"].filter(Boolean).join(" · "),
      t.due_date && `Due ${formatDateOnly(t.due_date)}`,
      `For ${n(t.assigned_to) ?? "you"}`,
      [n(t.contact) && `with ${n(t.contact)}`, n(t.resident), n(t.facility)].filter(Boolean).join(" · "),
      t.description,
    ])
  );
  return items;
}

/** Dates the person confirmed or corrected on the review screen. */
function withDateFixes(plan: Plan, fixes: DateFixes): Plan {
  return {
    ...plan,
    interactions: plan.interactions.map((x, i) =>
      fixes[i] ? { ...x, occurred_at: fixes[i], date_unclear: null } : x
    ),
  };
}

/** The plan with every unticked card taken out. Anything that depended
 * on a removed new person is dropped by the server, which reports it. */
function withoutSkipped(plan: Plan, skipped: Set<string>): Plan {
  const keep = <T,>(section: Section, list: T[]) => list.filter((_, i) => !skipped.has(`${section}:${i}`));
  return {
    ...plan,
    new_facilities: keep("new_facilities", plan.new_facilities),
    new_residents: keep("new_residents", plan.new_residents),
    new_contacts: keep("new_contacts", plan.new_contacts),
    resident_updates: keep("resident_updates", plan.resident_updates),
    transfers: keep("transfers", plan.transfers),
    facility_updates: keep("facility_updates", plan.facility_updates),
    profile_notes: keep("profile_notes", plan.profile_notes),
    interactions: keep("interactions", plan.interactions),
    tasks: keep("tasks", plan.tasks),
  };
}

/** Where the person said a "new" resident is really someone already in
 * the CRM: drop the new resident and point everything at the existing one. */
function withDecisions(plan: Plan, decisions: Decisions): Plan {
  const existing = new Map(
    Object.entries(decisions)
      .filter(([, choice]) => choice !== "new")
      .map(([key, id]) => [`new:${key}`, id])
  );
  if (existing.size === 0) return plan;
  const swap = (ref: string | null) => (ref && existing.has(ref) ? existing.get(ref)! : ref);
  return {
    ...plan,
    new_residents: plan.new_residents.filter((r) => !existing.has(`new:${r.key}`)),
    new_contacts: plan.new_contacts.map((c) => ({ ...c, resident: swap(c.resident) })),
    profile_notes: plan.profile_notes.map((p) => ({ ...p, resident: swap(p.resident) })),
    interactions: plan.interactions.map((x) => ({ ...x, resident: swap(x.resident) })),
    tasks: plan.tasks.map((t) => ({ ...t, resident: swap(t.resident) })),
  };
}

export function QuickLog({
  onSite,
}: {
  /** On-site mode: the facility the person is at, so notes don't need to name it. */
  onSite?: { facilityId: string; facilityName: string };
} = {}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [proposal, setProposal] = useState<{ plan: Plan; names: PlanNames; matches: PossibleMatches } | null>(null);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [dateFixes, setDateFixes] = useState<DateFixes>({});
  const [editing, setEditing] = useState<string | null>(null);

  /** Applies the person's corrections to one card. */
  const applyEdit = (section: Section, index: number, values: Record<string, string>) => {
    setProposal((prev) => {
      if (!prev) return prev;
      const list = [...(prev.plan[section] as Record<string, unknown>[])];
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        const trimmed = value.trim();
        if (key === "minutes_spent") patch[key] = trimmed ? Math.max(0, Math.round(Number(trimmed))) || null : null;
        else if (key === "name" || key === "title" || key === "note" || key === "occurred_at") patch[key] = trimmed || list[index][key];
        else patch[key] = trimmed || null;
      }
      // A resident needs at least a first or last name.
      if (section === "new_residents" && !patch.first_name && !patch.last_name) {
        patch.first_name = list[index].first_name;
        patch.last_name = list[index].last_name;
      }
      // A date the person set themselves no longer needs checking.
      if ("occurred_at" in patch) patch.date_unclear = null;
      const updated = { ...list[index], ...patch };
      list[index] = updated;
      const names = { ...prev.names };
      if (section === "new_residents") {
        const r = updated as Plan["new_residents"][number];
        names[`new:${r.key}`] = `${residentName(r)} (new)`;
      }
      if (section === "new_contacts") {
        const c = updated as Plan["new_contacts"][number];
        names[`new:${c.key}`] = `${c.name} (new)`;
      }
      return { ...prev, names, plan: { ...prev.plan, [section]: list } };
    });
    if (section === "interactions") {
      setDateFixes((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
    setEditing(null);
  };
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  const read = () => {
    setError(null);
    setResult(null);
    startReading(async () => {
      let response: Awaited<ReturnType<typeof analyzeNote>>;
      try {
        response = await analyzeNote(note, onSite ? { facilityId: onSite.facilityId } : undefined);
      } catch {
        // The connection dropped or the server gave up -- say so, and
        // keep the note in the box.
        setError("Couldn't finish reading your note (the connection dropped or it took too long). Your note is still here -- tap Read my note again.");
        return;
      }
      if (!response.ok) {
        setError(response.error);
        setProposal(null);
        return;
      }
      setProposal({ plan: response.plan, names: response.names, matches: response.matches });
      setSkipped(new Set());
      setDecisions({});
      setDateFixes({});
      setEditing(null);
    });
  };

  const save = () => {
    if (!proposal) return;
    setSaveError(null);
    startSaving(async () => {
      let response: ApplyResult;
      try {
        response = await applyPlan(withDecisions(withoutSkipped(withDateFixes(proposal.plan, dateFixes), skipped), decisions));
      } catch {
        // Saving twice is safe (each entry has a fixed id), so the list
        // stays up for another try.
        setSaveError("Couldn't confirm the save (the connection dropped). Tap Save again -- nothing will be logged twice.");
        return;
      }
      setResult(response);
      setProposal(null);
      // Refresh the rest of the page (e.g. on-site lists, last visits).
      router.refresh();
    });
  };

  const startOver = () => {
    setNote("");
    setProposal(null);
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {result.ok ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-destructive" />}
            {result.ok ? "Saved" : "Saved, with some problems"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {result.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {step.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <span>
                  {step.href ? (
                    <Link href={step.href} className="font-medium underline-offset-2 hover:underline">
                      {step.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{step.label}</span>
                  )}
                  {step.error ? <span className="block text-destructive">{step.error}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <Button onClick={startOver} className="self-start">
            <Sparkles /> {onSite ? "Add more notes" : "Log something else"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Cards read "Shirly", not "Shirley (new)", once the person says it's her.
  const shownNames: PlanNames = proposal ? { ...proposal.names } : {};
  for (const [key, choice] of Object.entries(decisions)) {
    if (choice !== "new") shownNames[`new:${key}`] = shownNames[choice] ?? shownNames[`new:${key}`];
  }
  const items = proposal ? describe(withDateFixes(proposal.plan, dateFixes), shownNames, getLocalToday()) : [];
  const chosen = items.filter((item) => !skipped.has(`${item.section}:${item.index}`)).length;
  // A flagged new resident that's still ticked needs an answer before saving.
  const undecided = items.filter(
    (item) =>
      item.newResidentKey &&
      proposal?.matches[item.newResidentKey]?.length &&
      !skipped.has(`${item.section}:${item.index}`) &&
      !decisions[item.newResidentKey]
  ).length;
  // ...and so does a ticked entry whose date the assistant wasn't sure of.
  const uncheckedDates = items.filter(
    (item) => item.dateIssue && !skipped.has(`${item.section}:${item.index}`)
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <label htmlFor="quick-log-note" className="text-base font-semibold">
            {onSite ? "Tell me what happened here, or what you need to remember." : "Tell me what happened, or what you need to remember."}
          </label>
          <VoiceButton
            disabled={reading || saving}
            onText={(text) => {
              setNote((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
              setProposal(null);
            }}
          />
          <Textarea
            id="quick-log-note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (proposal) setProposal(null);
            }}
            placeholder={onSite ? ONSITE_EXAMPLE : EXAMPLE}
            rows={6}
            className="min-h-40"
            disabled={reading || saving}
          />
          <p className="text-xs text-muted-foreground">
            Just talk, the way you&apos;d tell a colleague: visits (today or catching up on earlier ones),
            reminders, room changes, new residents or facilities. You don&apos;t need to say where it goes.
            Nothing is saved until you check it.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={read} disabled={reading || saving || !note.trim()} size="lg" className="w-full sm:w-auto sm:self-start">
            {reading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {reading ? "Reading your note…" : proposal ? "Read it again" : "Read my note"}
          </Button>
        </CardContent>
      </Card>

      {proposal ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Here&apos;s what I&apos;ll save</CardTitle>
            <p className="text-sm text-muted-foreground">{proposal.plan.summary}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {proposal.plan.questions.length > 0 ? (
              <div className="rounded-lg border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-sm text-[var(--tone-attention-fg)]">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <HelpCircle className="size-4" /> Please check
                </p>
                <ul className="list-disc pl-5">
                  {proposal.plan.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">Add the answer to your note above and tap &ldquo;Read it again&rdquo;.</p>
              </div>
            ) : null}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to save from this note.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => {
                  const id = `${item.section}:${item.index}`;
                  const on = !skipped.has(id);
                  const Icon = item.icon;
                  return (
                    <li key={id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                          on ? "bg-card" : "bg-muted opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setSkipped((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                          className="mt-1 size-4 accent-[var(--primary)]"
                        />
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                        <span className="flex flex-col gap-0.5 text-sm">
                          <span className="font-medium">
                            {item.newResidentKey && decisions[item.newResidentKey] && decisions[item.newResidentKey] !== "new"
                              ? `Use ${shownNames[decisions[item.newResidentKey]]} (already in the CRM)`
                              : item.title}
                          </span>
                          {item.lines.map((line, i) => (
                            <span key={i} className="text-muted-foreground">
                              {line}
                            </span>
                          ))}
                        </span>
                      </label>
                      {on && editing !== id ? (
                        <button
                          type="button"
                          onClick={() => setEditing(id)}
                          className="mt-1 flex items-center gap-1 px-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
                        >
                          <Pencil className="size-3.5" /> Edit
                        </button>
                      ) : null}
                      {on && editing === id ? (
                        <CardEditor
                          fields={editFieldsFor(proposal.plan, item.section, item.index)}
                          values={
                            withDateFixes(proposal.plan, dateFixes)[item.section][item.index] as unknown as Record<string, unknown>
                          }
                          onDone={(values) => applyEdit(item.section, item.index, values)}
                          onCancel={() => setEditing(null)}
                        />
                      ) : null}
                      {item.dateIssue && on ? (
                        <CheckDate
                          reason={item.dateIssue}
                          value={proposal.plan.interactions[item.index].occurred_at}
                          onConfirm={(value) => setDateFixes((prev) => ({ ...prev, [item.index]: value }))}
                        />
                      ) : null}
                      {item.newResidentKey && on && proposal.matches[item.newResidentKey]?.length ? (
                        <MaybeSamePerson
                          matches={proposal.matches[item.newResidentKey]}
                          choice={decisions[item.newResidentKey]}
                          onChoose={(choice) => setDecisions((prev) => ({ ...prev, [item.newResidentKey!]: choice }))}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving || chosen === 0 || undecided > 0 || uncheckedDates > 0 || editing !== null}>
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {saving ? "Saving…" : `Save ${chosen} ${chosen === 1 ? "item" : "items"}`}
              </Button>
              <Button variant="outline" onClick={() => setProposal(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
            {editing !== null ? (
              <p className="text-sm font-medium text-[var(--tone-attention-fg)]">Tap Done on the card you&apos;re editing, then Save.</p>
            ) : undecided > 0 || uncheckedDates > 0 ? (
              <p className="text-sm font-medium text-[var(--tone-attention-fg)]">
                Before saving, answer the highlighted {undecided > 0 && uncheckedDates > 0 ? "questions" : undecided > 0 ? "\u201csame person or someone new?\u201d" : "\u201ccheck the date\u201d"} above, or untick that item.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">Untick anything that&apos;s wrong, or tap Edit to fix a spelling, date or detail.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** The small form under a card when the person taps Edit. */
function CardEditor({
  fields,
  values,
  onDone,
  onCancel,
}: {
  fields: EditField[];
  values: Record<string, unknown>;
  onDone: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => {
        const value = values[f.key];
        const text = value === null || value === undefined ? "" : String(value);
        return [f.key, f.kind === "datetime" ? text.slice(0, 16) : text];
      })
    )
  );
  const set = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const inputClass = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground";
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{f.label}</span>
          {f.kind === "textarea" ? (
            <textarea rows={2} value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputClass} />
          ) : f.kind === "select" ? (
            <select value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} className={cn(inputClass, "h-9")}>
              {f.key === "relationship_to_resident" ? <option value="">Not sure</option> : null}
              {f.options!.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.kind === "datetime" ? "datetime-local" : f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
              inputMode={f.kind === "number" ? "numeric" : undefined}
              min={f.kind === "number" ? 0 : undefined}
              value={draft[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              className={cn(inputClass, "h-9")}
            />
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => onDone(draft)}>
          Done
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Under a logged entry whose date the assistant wasn't sure of ("Monday"
 * said on a Monday): the person confirms or fixes it before saving, so a
 * past visit never quietly lands on the wrong day. */
function CheckDate({
  reason,
  value,
  onConfirm,
}: {
  reason: string;
  value: string;
  onConfirm: (value: string) => void;
}) {
  const [date, setDate] = useState(value.slice(0, 16));
  return (
    <div className="mt-1 rounded-lg border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-sm text-[var(--tone-attention-fg)]">
      <p className="mb-2 flex items-center gap-1.5 font-semibold">
        <CalendarClock className="size-4" /> Check the date: {reason}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="When it happened"
          className="h-9 rounded-md border border-input bg-background px-2 text-foreground"
        />
        <Button type="button" size="sm" disabled={!date} onClick={() => onConfirm(date)}>
          This date is right
        </Button>
      </div>
    </div>
  );
}

/** Under a "new resident" card whose name nearly matches someone already
 * at that facility: the person must say which it is before saving, so a
 * misspelling never quietly creates a second record. */
function MaybeSamePerson({
  matches,
  choice,
  onChoose,
}: {
  matches: { id: string; name: string }[];
  choice: string | undefined;
  onChoose: (choice: string) => void;
}) {
  return (
    <div className="mt-1 rounded-lg border border-[var(--tone-attention-fg)]/30 bg-[var(--tone-attention-bg)] p-3 text-sm text-[var(--tone-attention-fg)]">
      <p className="mb-2 font-semibold">This may be someone already in the CRM. Same person?</p>
      <div className="flex flex-wrap gap-2">
        {matches.map((m) => (
          <Button
            key={m.id}
            type="button"
            size="sm"
            variant={choice === m.id ? "default" : "outline"}
            onClick={() => onChoose(m.id)}
          >
            Yes, it&apos;s {m.name}
          </Button>
        ))}
        <Button type="button" size="sm" variant={choice === "new" ? "default" : "outline"} onClick={() => onChoose("new")}>
          No, someone new
        </Button>
      </div>
      {choice && choice !== "new" ? (
        <p className="mt-2 text-xs">Nobody new will be added; this note is logged on their record.</p>
      ) : null}
    </div>
  );
}
