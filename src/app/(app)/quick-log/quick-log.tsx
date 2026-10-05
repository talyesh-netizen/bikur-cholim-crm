"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { analyzeNote, applyPlan } from "@/lib/actions/assistant";
import type { ApplyResult, Plan, PlanNames } from "@/lib/assistant/schema";
import { labelFor, INTERACTION_TYPES, HOLIDAYS } from "@/lib/domain/interaction";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { CONTACT_TYPES, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { ENGAGEMENT_STATUSES, VISIT_PRIORITIES, KOSHER_FOOD_OPTIONS } from "@/lib/domain/facility";
import { TASK_CATEGORIES } from "@/lib/domain/task";
import { formatDateOnly, formatDateTimeWithTime, orgLocalToIso } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type Section = keyof Omit<Plan, "summary" | "questions">;
type Item = { section: Section; index: number; icon: LucideIcon; title: string; lines: string[] };

const EXAMPLE =
  "Visited Mrs. Rivka Cohen at Menorah Park this afternoon, about 45 minutes. She moved to room 212. Her daughter Sarah Levine (216-555-0142) asked if we can bring grape juice for Shabbos — need to drop it off by Friday.";

/** Turns a plan into the plain-English cards shown for review. */
function describe(plan: Plan, names: PlanNames): Item[] {
  const n = (ref: string | null) => (ref ? names[ref] ?? "someone" : null);
  const items: Item[] = [];
  const add = (section: Section, index: number, icon: LucideIcon, title: string, lines: (string | null | false)[]) =>
    items.push({ section, index, icon, title, lines: lines.filter(Boolean) as string[] });

  plan.new_residents.forEach((r, i) =>
    add("new_residents", i, UserPlus, `Add new resident: ${r.first_name} ${r.last_name}`, [
      `At ${n(r.facility)}${r.room_number ? `, room ${r.room_number}` : ""}`,
      r.status !== "active" && `Status: ${labelFor(RESIDENT_STATUSES, r.status)}`,
      r.kosher_food_needs && `Kosher food: ${r.kosher_food_needs}`,
      r.visitation_needs && `Visiting: ${r.visitation_needs}`,
      r.holiday_support_needs && `Holidays: ${r.holiday_support_needs}`,
      r.private_internal_notes && `Private note: ${r.private_internal_notes}`,
    ])
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
  plan.interactions.forEach((x, i) => {
    const iso = orgLocalToIso(x.occurred_at);
    add("interactions", i, HeartHandshake, `Log: ${labelFor(INTERACTION_TYPES, x.interaction_type)}${x.holiday ? ` · ${labelFor(HOLIDAYS, x.holiday)}` : ""}`, [
      [n(x.resident), n(x.contact) && `with ${n(x.contact)}`, n(x.facility) && `at ${n(x.facility)}`].filter(Boolean).join(" "),
      x.volunteers.length > 0 && `Volunteers: ${x.volunteers.map(n).join(", ")}`,
      iso && formatDateTimeWithTime(iso),
      x.minutes_spent ? `${x.minutes_spent} minutes` : null,
      x.notes,
    ]);
  });
  plan.tasks.forEach((t, i) =>
    add("tasks", i, ListPlus, `Follow-up: ${t.title}`, [
      [labelFor(TASK_CATEGORIES, t.task_category), t.priority === "high" && "high priority"].filter(Boolean).join(" · "),
      t.due_date && `Due ${formatDateOnly(t.due_date)}`,
      `For ${n(t.assigned_to) ?? "you"}`,
      [n(t.resident), n(t.facility)].filter(Boolean).join(" · "),
      t.description,
    ])
  );
  return items;
}

/** The plan with every unticked card taken out. Anything that depended
 * on a removed new person is dropped by the server, which reports it. */
function withoutSkipped(plan: Plan, skipped: Set<string>): Plan {
  const keep = <T,>(section: Section, list: T[]) => list.filter((_, i) => !skipped.has(`${section}:${i}`));
  return {
    ...plan,
    new_residents: keep("new_residents", plan.new_residents),
    new_contacts: keep("new_contacts", plan.new_contacts),
    resident_updates: keep("resident_updates", plan.resident_updates),
    transfers: keep("transfers", plan.transfers),
    facility_updates: keep("facility_updates", plan.facility_updates),
    interactions: keep("interactions", plan.interactions),
    tasks: keep("tasks", plan.tasks),
  };
}

export function QuickLog() {
  const [note, setNote] = useState("");
  const [proposal, setProposal] = useState<{ plan: Plan; names: PlanNames } | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  const read = () => {
    setError(null);
    setResult(null);
    startReading(async () => {
      const response = await analyzeNote(note);
      if (!response.ok) {
        setError(response.error);
        setProposal(null);
        return;
      }
      setProposal({ plan: response.plan, names: response.names });
      setSkipped(new Set());
    });
  };

  const save = () => {
    if (!proposal) return;
    startSaving(async () => {
      const response = await applyPlan(withoutSkipped(proposal.plan, skipped));
      setResult(response);
      setProposal(null);
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
            <Sparkles /> Log something else
          </Button>
        </CardContent>
      </Card>
    );
  }

  const items = proposal ? describe(proposal.plan, proposal.names) : [];
  const chosen = items.filter((item) => !skipped.has(`${item.section}:${item.index}`)).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <label htmlFor="quick-log-note" className="text-sm font-medium">
            What happened?
          </label>
          <Textarea
            id="quick-log-note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (proposal) setProposal(null);
            }}
            placeholder={EXAMPLE}
            rows={6}
            className="min-h-40"
            disabled={reading || saving}
          />
          <p className="text-xs text-muted-foreground">
            On a phone, tap the microphone on your keyboard to speak instead of typing. Names, rooms, phone
            numbers and anything that needs following up all help.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={read} disabled={reading || saving || !note.trim()} className="self-start">
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
                          <span className="font-medium">{item.title}</span>
                          {item.lines.map((line, i) => (
                            <span key={i} className="text-muted-foreground">
                              {line}
                            </span>
                          ))}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving || chosen === 0}>
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {saving ? "Saving…" : `Save ${chosen} ${chosen === 1 ? "item" : "items"}`}
              </Button>
              <Button variant="outline" onClick={() => setProposal(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Untick anything that&apos;s wrong. You can fix details afterwards on the record itself.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
