"use client";

import { offeredOptions } from "@/lib/domain/offered";
import { OFFERED_FACILITY_TYPES } from "@/lib/domain/facility";
import { OFFERED_CONTACT_TYPES, OFFERED_RELATIONSHIPS } from "@/lib/domain/contact";
import { TYPE_BUTTONS } from "@/lib/domain/interaction";
import { useEffect, useState, useTransition } from "react";
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
import { PlacePicker, type Place, type PlaceFacility } from "./place-picker";
import { residentName } from "@/lib/domain/resident-name";
import { analyzeNote, applyPlan } from "@/lib/actions/assistant";
import type { ApplyResult, Plan, PlanNames, PossibleMatches } from "@/lib/assistant/schema";
import { labelFor, INTERACTION_TYPES, HOLIDAYS, FAMILY_NEEDS } from "@/lib/domain/interaction";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { CONTACT_TYPES, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { ENGAGEMENT_STATUSES, VISIT_PRIORITIES, KOSHER_FOOD_OPTIONS, FACILITY_TYPES } from "@/lib/domain/facility";
import { formatDateOnly, formatDateTimeWithTime, getLocalToday, orgLocalToIso } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type Section = keyof Omit<Plan, "summary" | "questions">;
/** Where a line on the check screen will be saved -- one plain label
 * per line, so it's never a guess (decided Oct 8, 2026). */
type Dest = "today" | "earlier" | "food" | "profile" | "followup" | "new" | "move";
const DEST_LABEL: Record<Dest, string> = {
  today: "Today's log",
  earlier: "Log (earlier day)",
  food: "Food",
  profile: "Their profile",
  followup: "Follow-up",
  new: "New in the CRM",
  move: "Moving",
};
const DEST_STYLE: Record<Dest, string> = {
  today: "text-[#2a78d6]",
  earlier: "text-[#2a78d6]",
  food: "text-[#b26a00]",
  profile: "text-[#8a4fbf]",
  followup: "text-[#1a8a5c]",
  new: "text-muted-foreground",
  move: "text-muted-foreground",
};

type Item = {
  /** Who it's about -- the check screen groups lines under this name. */
  who: string;
  dest: Dest;
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

/** What can be corrected on each kind of card -- the details people
 * actually get wrong (a spelling, a relationship, a date), not every
 * field. Anything else is fixed on the record after saving. */
function editFieldsFor(plan: Plan, section: Section, index: number): EditField[] {
  switch (section) {
    case "new_facilities":
      return [
        { key: "name", label: "Name" },
        { key: "facility_type", label: "Type", kind: "select", options: offeredOptions(FACILITY_TYPES, OFFERED_FACILITY_TYPES, plan.new_facilities[index].facility_type) },
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
        { key: "contact_type", label: "Who they are", kind: "select", options: offeredOptions(CONTACT_TYPES, OFFERED_CONTACT_TYPES, c.contact_type) },
        ...(c.resident
          ? [{ key: "relationship_to_resident", label: "Relationship", kind: "select" as const, options: offeredOptions(RESIDENT_CONTACT_RELATIONSHIPS, OFFERED_RELATIONSHIPS, c.relationship_to_resident) }]
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
        // The same 8 choices as the log form (an unusual type it read
        // stays selectable so it isn't silently changed).
        { key: "interaction_type", label: "Type", kind: "select", options: offeredOptions(INTERACTION_TYPES, TYPE_BUTTONS.flatMap((b) => b.choices.map((c) => c.value)), plan.interactions[index].interaction_type) },
        { key: "occurred_at", label: "When", kind: "datetime" },
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
export function describe(plan: Plan, names: PlanNames, today: string): Item[] {
  const n = (ref: string | null) => (ref ? names[ref] ?? "someone" : null);
  const items: Item[] = [];
  const add = (
    who: string | null,
    dest: Dest,
    section: Section,
    index: number,
    icon: LucideIcon,
    title: string,
    lines: (string | null | false)[],
    newResidentKey?: string,
    dateIssue?: string
  ) =>
    items.push({ who: who || "General", dest, section, index, icon, title, lines: lines.filter(Boolean) as string[], newResidentKey, dateIssue });

  plan.new_facilities.forEach((f, i) =>
    add(f.name, "new", "new_facilities", i, Building2, `New facility: ${f.name}`, [
      labelFor(FACILITY_TYPES, f.facility_type),
      [f.address, f.city].filter(Boolean).join(", ") || null,
      f.notes && `Note: ${f.notes}`,
    ])
  );
  plan.new_residents.forEach((r, i) =>
    add(residentName(r), "new", "new_residents", i, UserPlus, `New resident: ${residentName(r)}`, [
      `At ${n(r.facility)}${r.room_number ? `, room ${r.room_number}` : ""}`,
      r.status !== "active" && `Status: ${labelFor(RESIDENT_STATUSES, r.status)}`,
      r.kosher_food_needs && `Kosher food: ${r.kosher_food_needs}`,
      r.visitation_needs && `Visiting: ${r.visitation_needs}`,
      r.holiday_support_needs && `Holidays: ${r.holiday_support_needs}`,
      r.private_internal_notes && `Private note: ${r.private_internal_notes}`,
    ], r.key)
  );
  plan.new_contacts.forEach((c, i) =>
    add(n(c.resident) ?? n(c.facility) ?? c.name, c.resident ? "profile" : "new", "new_contacts", i, UserPlus, c.resident ? `Family: ${c.name}` : `New contact: ${c.name}`, [
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
    add(n(u.resident), "profile", "resident_updates", i, PencilLine, "Update their details", [
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
    add(n(t.resident), "move", "transfers", i, ArrowRightLeft, `Moves to ${n(t.new_facility)}`, [t.reason && `Reason: ${t.reason}`])
  );
  plan.facility_updates.forEach((u, i) =>
    add(n(u.facility), "profile", "facility_updates", i, Building2, "Update the facility", [
      u.engagement_status && `Engagement → ${labelFor(ENGAGEMENT_STATUSES, u.engagement_status)}`,
      u.visit_priority && `Visit priority → ${labelFor(VISIT_PRIORITIES, u.visit_priority)}`,
      u.kosher_food_availability && `Kosher food → ${labelFor(KOSHER_FOOD_OPTIONS, u.kosher_food_availability)}`,
      u.main_phone && `Main phone → ${u.main_phone}`,
      u.add_to_notes && `Notes: + ${u.add_to_notes}`,
    ])
  );
  plan.profile_notes.forEach((p, i) =>
    add(n(p.resident) ?? n(p.facility), "profile", "profile_notes", i, StickyNote, p.note, [])
  );
  plan.interactions.forEach((x, i) => {
    const iso = orgLocalToIso(x.occurred_at);
    add(
      n(x.resident) ?? n(x.contact) ?? n(x.facility),
      x.interaction_type === "food_delivery" ? "food" : x.occurred_at.slice(0, 10) === today ? "today" : "earlier",
      "interactions", i, HeartHandshake, `${TYPE_BUTTONS.find((b) => b.choices.some((c) => c.value === x.interaction_type))?.label ?? labelFor(INTERACTION_TYPES, x.interaction_type)}${x.holiday ? ` · ${labelFor(HOLIDAYS, x.holiday)}` : ""}${x.family_need ? ` · ${labelFor(FAMILY_NEEDS, x.family_need)}` : ""}`, [
      // The person is the heading above; say only who else and where.
      [n(x.contact) && `with ${n(x.contact)}`, x.resident && n(x.facility) && `at ${n(x.facility)}`].filter(Boolean).join(" ") || null,
      // The date comes first: a past entry ("catching up from Monday")
      // must be visibly on the right day.
      iso && `${x.occurred_at.slice(0, 10) === today ? "Today" : "Earlier"} · ${formatDateTimeWithTime(iso)}`,
      x.volunteers.length > 0 && `Volunteers: ${x.volunteers.map(n).join(", ")}`,
      x.also_by.length > 0 && `With ${x.also_by.map(n).join(", ")}`,
      x.minutes_spent ? `${x.minutes_spent} minutes` : null,
      x.people_reached ? `${x.people_reached} ${x.people_reached === 1 ? "person" : "people"} reached` : null,
      x.notes,
    ], undefined, x.date_unclear ?? undefined);
  });
  plan.tasks.forEach((t, i) =>
    add(n(t.resident) ?? n(t.contact) ?? n(t.facility), "followup", "tasks", i, ListPlus, t.title, [
      t.priority === "high" && "Urgent",
      t.due_date && `Due ${formatDateOnly(t.due_date)}`,
      `For ${n(t.assigned_to) ?? "you"}`,
      n(t.contact) && t.resident ? `with ${n(t.contact)}` : null,
      t.description,
    ])
  );
  return items;
}

/** Lines grouped under the person (or place) they're about, in the
 * order each person first appears. */
export function groupByWho(items: Item[]): [string, Item[]][] {
  const groups = new Map<string, Item[]>();
  const order: Dest[] = ["today", "earlier", "food", "profile", "move", "followup", "new"];
  for (const item of items) groups.set(item.who, [...(groups.get(item.who) ?? []), item]);
  return [...groups.entries()].map(([who, group]) => [who, group.sort((a, b) => order.indexOf(a.dest) - order.indexOf(b.dest))]);
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
  facilities,
  about,
  initialPlace,
}: {
  /** Opened from a resident's page (+ Log): the note is about them. */
  about?: { residentId: string; residentName: string };
  /** Where it happened, when "+ Log" was tapped on a facility or resident. */
  initialPlace?: Place;
  /** On-site mode: the facility the person is at, so notes don't need to name it. */
  onSite?: { facilityId: string; facilityName: string };
  /** When given (and not on site), Quick Log first asks where it happened. */
  facilities?: PlaceFacility[];
} = {}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [place, setPlace] = useState<Place | null>(initialPlace ?? null);
  // The note is kept on this phone until it's saved, so a reload, a
  // locked phone or a dropped connection never loses it.
  const draftKey = `quick-log-draft:${onSite?.facilityId ?? about?.residentId ?? (initialPlace?.kind === "facility" ? initialPlace.id : "any")}`;
  const [restored, setRestored] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    // Read after the first paint (the server can't see this phone's storage).
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(draftKey);
        if (saved?.trim()) {
          setNote((current) => current || saved);
          setRestored(true);
        }
      } catch {
        // Private browsing or blocked storage: carry on without drafts.
      }
      setDraftLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      if (note.trim()) window.localStorage.setItem(draftKey, note);
      else window.localStorage.removeItem(draftKey);
    } catch {
      // See above.
    }
  }, [draftKey, draftLoaded, note]);
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
        response = await analyzeNote(
          note,
          {
            ...(onSite
              ? { facilityId: onSite.facilityId, here: true }
              : place?.kind === "facility"
                ? { facilityId: place.id }
                : place?.kind === "new"
                  ? { newFacilityName: place.name }
                  : {}),
            ...(about ? { residentId: about.residentId } : {}),
          }
        );
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
      // Saved: the draft is done with (kept if anything failed).
      if (response.ok) setNote("");
      // Refresh the rest of the page (e.g. on-site lists, last visits).
      router.refresh();
    });
  };

  const startOver = () => {
    setNote("");
    setRestored(false);
    setPlace(initialPlace ?? null);
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
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={startOver} size="lg">
              <Sparkles /> {onSite ? "Add more notes" : "Log something else"}
            </Button>
            {about ? (
              <Button asChild size="lg" variant="outline">
                <Link href={`/residents/${about.residentId}`}>Back to {about.residentName}</Link>
              </Button>
            ) : !onSite && initialPlace?.kind === "facility" ? (
              <Button asChild size="lg" variant="outline">
                <Link href={`/facilities/${initialPlace.id}/onsite`}>Back to {initialPlace.name}</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  // First question: where did it happen? (Skipped on site -- the
  // facility is already known.)
  if (facilities && !onSite && !place) {
    return <PlacePicker facilities={facilities} onChoose={setPlace} />;
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
            {about
              ? `What happened with ${about.residentName}?`
              : onSite
                ? "Tell me what happened here, or what you need to remember."
                : "Tell me what happened, or what you need to remember."}
          </label>
          {!onSite && place ? (
            <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>
                Where:{" "}
                <span className="font-medium text-foreground">
                  {place.kind === "facility" ? place.name : place.kind === "new" ? `${place.name} (new facility)` : "not one place"}
                </span>
              </span>
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                disabled={reading || saving}
                onClick={() => {
                  setPlace(null);
                  setProposal(null);
                }}
              >
                Change
              </button>
            </p>
          ) : null}
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
            placeholder={
              about
                ? "e.g. Visited her, she was upbeat. Gave her a snack. Bring a large-print siddur next week."
                : onSite || place?.kind === "facility" || place?.kind === "new"
                  ? ONSITE_EXAMPLE
                  : EXAMPLE
            }
            rows={6}
            className="min-h-40"
            disabled={reading || saving}
          />
          {restored && note.trim() && !proposal ? (
            <p className="text-sm text-muted-foreground">Your unsaved note was kept. Carry on, or tap Read my note.</p>
          ) : null}
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
            <CardTitle className="text-base">Check before saving</CardTitle>
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
              <div className="flex flex-col gap-4">
                {/* Grouped by person, so everything about Ruth sits together;
                    each line says exactly where it will be saved. */}
                {groupByWho(items).map(([who, group]) => (
                <section key={who} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <h3 className="text-base font-semibold">{who}</h3>
                <ul className="flex flex-col gap-2">
                {group.map((item) => {
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
                          <span className={cn("text-xs font-bold uppercase tracking-wide", DEST_STYLE[item.dest])}>
                            {DEST_LABEL[item.dest]}
                          </span>
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
                </section>
                ))}
              </div>
            )}

            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving || chosen === 0 || undecided > 0 || uncheckedDates > 0 || editing !== null}>
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {saving ? "Saving…" : chosen === items.length ? `Save all ${chosen}` : `Save ${chosen} of ${items.length}`}
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
