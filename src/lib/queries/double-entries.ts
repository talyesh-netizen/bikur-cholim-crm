import { createClient } from "@/lib/supabase/server";
import { orgDayKey } from "@/lib/format-date";
import { residentName } from "@/lib/domain/resident-name";
import { selectAllPages } from "@/lib/queries/impact";

/**
 * Suspected double entries (Build 2, Oct 16, 2026): two entries of the
 * same kind, with the same person, on the same Cleveland day -- usually
 * the same visit saved once by each staff member who was there. They are
 * only ever SUGGESTED here; an admin answers each pair ("Same visit" or
 * "Separate visits") and nothing is decided automatically.
 */

export type DoubleEntrySide = {
  id: string;
  occurred_at: string;
  created_at: string;
  staff_name: string | null;
  facility_name: string | null;
  notes: string | null;
};

export type DoubleEntryPair = {
  key: string;
  type: string;
  day: string;
  person: string;
  /** The entry kept if the answer is "Same visit" -- the first one entered. */
  kept: DoubleEntrySide;
  other: DoubleEntrySide;
};

export type ReviewedPair = {
  id: string;
  decision: "same" | "separate";
  decided_at: string;
  decided_by: string | null;
  kept_id: string;
  other_id: string;
  label: string;
};

type Row = {
  id: string;
  occurred_at: string;
  created_at: string;
  interaction_type: string;
  resident_id: string | null;
  contact_id: string | null;
  notes: string | null;
  counted_in_id: string | null;
  residents: { first_name: string | null; last_name: string | null; preferred_name: string | null } | null;
  contacts: { name: string } | null;
  facilities: { name: string } | null;
  profiles: { full_name: string } | null;
};

const side = (r: Row): DoubleEntrySide => ({
  id: r.id,
  occurred_at: r.occurred_at,
  created_at: r.created_at,
  staff_name: r.profiles?.full_name ?? null,
  facility_name: r.facilities?.name ?? null,
  notes: r.notes,
});

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export async function listDoubleEntries(): Promise<{ open: DoubleEntryPair[]; reviewed: ReviewedPair[] }> {
  const supabase = await createClient();
  const [rows, reviews, people] = await Promise.all([
    selectAllPages<Row>((from, to) =>
      supabase
        .from("interactions")
        .select(
          "id, occurred_at, created_at, interaction_type, resident_id, contact_id, notes, counted_in_id, residents(first_name, last_name, preferred_name), contacts!interactions_contact_id_fkey(name), facilities(name), profiles!interactions_staff_member_id_fkey(full_name)"
        )
        .or("resident_id.not.is.null,contact_id.not.is.null")
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    ),
    supabase
      .from("duplicate_reviews")
      .select("id, kept_id, other_id, decision, decided_at, decided_by")
      .order("decided_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const reviewRows = (reviews.data ?? []) as {
    id: string;
    kept_id: string;
    other_id: string;
    decision: "same" | "separate";
    decided_at: string;
    decided_by: string | null;
  }[];
  const answered = new Set(reviewRows.map((r) => pairKey(r.kept_id, r.other_id)));
  const nameOf = new Map(((people.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Same kind + same person + same day, among entries still counted.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.counted_in_id) continue;
    const person = r.resident_id ?? r.contact_id;
    const key = `${r.interaction_type}|${person}|${orgDayKey(r.occurred_at)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const open: DoubleEntryPair[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const [first, ...rest] = group;
    for (const other of rest) {
      if (answered.has(pairKey(first.id, other.id))) continue;
      open.push({
        key: `${key}|${other.id}`,
        type: first.interaction_type,
        day: orgDayKey(first.occurred_at),
        person: first.residents ? residentName(first.residents) : first.contacts?.name ?? "Someone",
        kept: side(first),
        other: side(other),
      });
    }
  }
  open.sort((a, b) => b.day.localeCompare(a.day));

  const reviewed: ReviewedPair[] = reviewRows.slice(0, 25).map((r) => {
    const kept = byId.get(r.kept_id);
    return {
      ...r,
      decided_by: r.decided_by ? nameOf.get(r.decided_by) ?? null : null,
      label: kept
        ? `${kept.residents ? residentName(kept.residents) : kept.contacts?.name ?? "Entry"} · ${orgDayKey(kept.occurred_at)}`
        : "Entry",
    };
  });

  return { open, reviewed };
}
