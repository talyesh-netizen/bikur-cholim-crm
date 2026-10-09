import { createClient } from "@/lib/supabase/server";
import { searchWords, everyWordInAny, sanitizeForOrFilter } from "@/lib/supabase-filters";
import { residentName } from "@/lib/domain/resident-name";
import { CONTACT_TYPES, labelFor } from "@/lib/domain/contact";
import { ORGANIZATION_TYPES } from "@/lib/domain/organization";
import { INTERACTION_TYPES } from "@/lib/domain/interaction";
import { OPEN_TASK_STATUSES, TASK_STATUSES } from "@/lib/domain/task";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";

export type SearchResult = {
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
  /** When it happened / is due, for activity and tasks. */
  date?: string | null;
  /** A few words of the note around what was searched for. */
  snippet?: string | null;
  /** A finished task, an inactive contact -- shown a little quieter. */
  muted?: boolean;
};

export type SearchGroupKey =
  | "residents"
  | "facilities"
  | "healthcareGroups"
  | "partners"
  | "family"
  | "volunteers"
  | "facilityStaff"
  | "otherContacts"
  | "staff"
  | "activity"
  | "tasks"
  | "notes";

export type SearchGroup = {
  key: SearchGroupKey;
  title: string;
  /** One word for the suggestion list ("Resident", "Task"). */
  kind: string;
  results: SearchResult[];
  /** Where "see all" goes when this group is cut short. */
  moreHref?: string;
};

const PER_GROUP = 10;
// Activity is what people most often can't find, so it gets more room.
const ACTIVITY_LIMIT = 20;

/** "…Chabad of the Falls Friday night program with 12…" -- the part of a
 * long note around the first searched word, so a result says why it
 * matched. */
function snippetFor(text: string | null | undefined, rawWords: string[], width = 110): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  let at = -1;
  for (const w of rawWords) {
    at = lower.indexOf(w.toLowerCase());
    if (at >= 0) break;
  }
  if (at < 0) return flat.length > width ? flat.slice(0, width).trimEnd() + "…" : flat;
  const start = Math.max(0, at - 35);
  const end = Math.min(flat.length, start + width);
  return (start > 0 ? "…" : "") + flat.slice(start, end).trim() + (end < flat.length ? "…" : "");
}

function joinParts(parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter((p): p is string => !!p && p.trim() !== "");
  return kept.length ? kept.join(" · ") : null;
}

type NameRow = { first_name: string | null; last_name: string | null; preferred_name: string | null } | null;

/**
 * One search across the whole CRM (decided Oct 9, 2026): people search
 * for what they remember, not for where it was filed. Every query runs
 * as the signed-in person, so the database's access rules decide what
 * each of them can see -- nothing here widens that. Private notes are
 * deliberately not searched.
 *
 * Each word is matched on its own, in any of a record's searched
 * fields: "Ruth Jacobs", "jacobs ruth" and "Jacobs" all find Ruth
 * Jacobs; "chabad falls" finds a program note that says "Chabad of the
 * Falls". Every record appears once, in one group.
 */
export async function searchAll(query: string): Promise<SearchGroup[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const rawWords = sanitizeForOrFilter(query).split(/\s+/).filter(Boolean);
  const encoded = encodeURIComponent(query.trim());
  const supabase = await createClient();

  const any = (columns: string[]) => everyWordInAny(words, columns) as string;

  const [residents, facilities, organizations, contacts, staff, activity, tasks, notes] = await Promise.all([
    supabase
      .from("residents")
      .select("id, first_name, last_name, preferred_name, room_number, status, facilities(name)")
      .or(any(["first_name", "last_name", "preferred_name", "room_number"]))
      .limit(PER_GROUP),
    supabase
      .from("facilities")
      .select("id, name, city, parent_healthcare_group, active")
      .or(any(["name", "city", "parent_healthcare_group"]))
      .order("name")
      .limit(PER_GROUP),
    supabase
      .from("organizations")
      .select("id, name, organization_type, city, active")
      .or(any(["name", "notes"]))
      .order("name")
      .limit(PER_GROUP * 2),
    supabase
      .from("contacts")
      .select("id, name, contact_type, organization, active")
      .or(any(["name", "organization"]))
      .order("name")
      .limit(PER_GROUP * 3),
    supabase
      .from("profiles")
      .select("id, full_name, role, active")
      .or(any(["full_name"]))
      .order("full_name")
      .limit(PER_GROUP),
    supabase
      .from("interactions")
      .select(
        "id, occurred_at, interaction_type, notes, outcome, facilities(name), residents(first_name, last_name, preferred_name), contacts!interactions_contact_id_fkey(name), profiles(full_name)"
      )
      .or(any(["notes", "outcome"]))
      .order("occurred_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    supabase
      .from("tasks")
      .select(
        "id, title, description, completion_notes, status, due_date, updated_at, residents(first_name, last_name, preferred_name), facilities(name), contacts(name)"
      )
      .or(any(["title", "description", "completion_notes"]))
      .order("updated_at", { ascending: false })
      .limit(PER_GROUP * 2),
    supabase
      .from("profile_notes")
      .select("id, clean_note, created_at, resident_id, facility_id, residents(first_name, last_name, preferred_name), facilities(name)")
      .or(any(["clean_note"]))
      .order("created_at", { ascending: false })
      .limit(PER_GROUP),
  ]);

  const groups: SearchGroup[] = [];
  const add = (group: SearchGroup) => {
    if (group.results.length > 0) groups.push(group);
  };

  add({
    key: "residents",
    title: "Residents",
    kind: "Resident",
    results: (residents.data ?? []).map((r) => {
      const facility = r.facilities as unknown as { name: string } | null;
      return {
        id: r.id,
        label: residentName(r),
        sublabel: joinParts([facility?.name, r.room_number ? `Room ${r.room_number}` : null]),
        href: `/residents/${r.id}`,
      };
    }),
  });

  add({
    key: "facilities",
    title: "Facilities",
    kind: "Facility",
    results: (facilities.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      sublabel: joinParts([f.city, f.parent_healthcare_group]),
      href: `/facilities/${f.id}`,
      muted: f.active === false,
    })),
  });

  const orgRows = organizations.data ?? [];
  const orgResult = (o: (typeof orgRows)[number], href: string): SearchResult => ({
    id: o.id,
    label: o.name,
    sublabel: joinParts([o.organization_type ? labelFor(ORGANIZATION_TYPES, o.organization_type) : null, o.city]),
    href,
    muted: o.active === false,
  });
  add({
    key: "healthcareGroups",
    title: "Healthcare groups",
    kind: "Group",
    results: orgRows
      .filter((o) => o.organization_type === "healthcare_group")
      .slice(0, PER_GROUP)
      .map((o) => orgResult(o, `/facilities/groups/${o.id}`)),
  });
  add({
    key: "partners",
    title: "Strategic Partners",
    kind: "Partner",
    results: orgRows
      .filter((o) => o.organization_type !== "healthcare_group")
      .slice(0, PER_GROUP)
      .map((o) => orgResult(o, `/organizations/${o.id}`)),
  });

  // Contacts are one table but four very different kinds of people, so
  // they're shown in the group a person would look for them under.
  const contactRows = contacts.data ?? [];
  const contactGroup = (key: SearchGroupKey, title: string, kind: string, types: string[] | null) =>
    add({
      key,
      title,
      kind,
      results: contactRows
        .filter((c) => (types ? types.includes(c.contact_type) : !["family_member", "volunteer", "facility_staff"].includes(c.contact_type)))
        .slice(0, PER_GROUP)
        .map((c) => ({
          id: c.id,
          label: c.name,
          sublabel: joinParts([types ? null : labelFor(CONTACT_TYPES, c.contact_type), c.organization, c.active === false ? "No longer active" : null]),
          href: `/contacts/${c.id}`,
          muted: c.active === false,
        })),
    });
  contactGroup("family", "Family members", "Family", ["family_member"]);
  contactGroup("volunteers", "Volunteers", "Volunteer", ["volunteer"]);
  contactGroup("facilityStaff", "Facility staff", "Facility staff", ["facility_staff"]);
  contactGroup("otherContacts", "Other contacts", "Contact", null);

  add({
    key: "staff",
    title: "Our staff",
    kind: "Staff",
    results: (staff.data ?? []).map((p) => ({
      id: p.id,
      label: p.full_name,
      sublabel: joinParts([p.role ? p.role[0].toUpperCase() + p.role.slice(1) : null, p.active === false ? "No longer active" : null, "see what they logged"]),
      href: `/interactions?staff=${p.id}`,
      muted: p.active === false,
    })),
  });

  const activityRows = activity.data ?? [];
  add({
    key: "activity",
    title: "Activity (visits, programs, calls, deliveries)",
    kind: "Activity",
    moreHref: activityRows.length >= ACTIVITY_LIMIT ? `/interactions?search=${encoded}` : undefined,
    results: activityRows.map((i) => {
      const facility = i.facilities as unknown as { name: string } | null;
      const resident = i.residents as unknown as NameRow;
      const contact = i.contacts as unknown as { name: string } | null;
      const by = i.profiles as unknown as { full_name: string } | null;
      return {
        id: i.id,
        label: labelFor(INTERACTION_TYPES, i.interaction_type),
        sublabel: joinParts([facility?.name, resident ? residentName(resident) : contact?.name, by?.full_name ? `by ${by.full_name}` : null]),
        date: formatDateTime(i.occurred_at),
        snippet: snippetFor(i.notes || i.outcome, rawWords),
        href: `/interactions/${i.id}`,
      };
    }),
  });

  const taskRows = tasks.data ?? [];
  const isOpen = (status: string) => (OPEN_TASK_STATUSES as readonly string[]).includes(status);
  add({
    key: "tasks",
    title: "Tasks (open and completed)",
    kind: "Task",
    // Open work first, then finished, each newest first.
    results: [...taskRows.filter((t) => isOpen(t.status)), ...taskRows.filter((t) => !isOpen(t.status))]
      .slice(0, PER_GROUP)
      .map((t) => {
        const resident = t.residents as unknown as NameRow;
        const facility = t.facilities as unknown as { name: string } | null;
        const contact = t.contacts as unknown as { name: string } | null;
        const open = isOpen(t.status);
        return {
          id: t.id,
          label: t.title,
          sublabel: joinParts([labelFor(TASK_STATUSES, t.status), resident ? residentName(resident) : contact?.name, facility?.name]),
          date: open ? (t.due_date ? `Due ${formatDateOnly(t.due_date)}` : null) : `Updated ${formatDateTime(t.updated_at)}`,
          snippet: snippetFor(t.description || t.completion_notes, rawWords),
          href: `/tasks/${t.id}`,
          muted: !open,
        };
      }),
  });

  add({
    key: "notes",
    title: "About them notes",
    kind: "Note",
    results: (notes.data ?? []).map((n) => {
      const resident = n.residents as unknown as NameRow;
      const facility = n.facilities as unknown as { name: string } | null;
      return {
        id: n.id,
        label: resident ? residentName(resident) : facility?.name ?? "Note",
        sublabel: resident ? "Resident" : "Facility",
        date: formatDateTime(n.created_at),
        snippet: snippetFor(n.clean_note, rawWords),
        href: n.resident_id ? `/residents/${n.resident_id}` : `/facilities/${n.facility_id}`,
      };
    }),
  });

  return groups;
}
