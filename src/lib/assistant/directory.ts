import type { SupabaseClient } from "@supabase/supabase-js";
import { residentName } from "@/lib/domain/resident-name";

/**
 * The "who's who" the Quick Log assistant reads before it decides what a
 * note is about: every facility, resident, contact and staff member the
 * signed-in person can see, each under a short alias ("F12", "R40",
 * "C7", "S2").
 *
 * It is loaded with the signed-in person's own database connection, so
 * a facility-restricted account only ever sends its own facilities'
 * people -- the same rows it can see on every other screen.
 *
 * Only what's needed to recognize who a note is about goes in: names,
 * facility, status, room, relationships and roles -- plus a facility's
 * old name when its notes record one ("Formerly named Royalton Woods"),
 * so a note using the old name still finds it. No phone numbers,
 * emails, other notes or visit history.
 */

export type Directory = {
  /** The text block handed to Claude. */
  text: string;
  /** alias -> real database ID */
  idFor: Map<string, string>;
  /** real database ID -> display name, for the review screen */
  nameFor: Map<string, string>;
  /** alias of the signed-in staff member, e.g. "S3" */
  selfAlias: string | null;
  /** Existing residents, for spotting a "new" resident who is really
   * someone already here under a slightly different spelling. */
  residents: { id: string; first_name: string | null; last_name: string | null; facility_id: string | null }[];
};

type FacilityRow = { id: string; name: string; city: string | null; active: boolean; notes: string | null };
type ResidentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  current_facility_id: string | null;
  room_number: string | null;
  status: string;
};
type ContactRow = { id: string; name: string; contact_type: string; organization: string | null; active: boolean };
type ResidentLinkRow = { resident_id: string; contact_id: string; relationship_to_resident: string };
type FacilityLinkRow = { facility_id: string; contact_id: string; role_at_facility: string | null };
type StaffRow = { id: string; full_name: string };

const clean = (value: string | null | undefined) => (value ?? "").replace(/[|\n\r]+/g, " ").trim();

/** Old names a facility's notes record, e.g. "Formerly named Royalton
 * Woods." or "Formerly Richmond Heights Place. Renamed ..." -> the old
 * name only; nothing else from the notes leaves the CRM. */
export function formerNames(notes: string | null): string[] {
  if (!notes) return [];
  const found = new Set<string>();
  for (const m of notes.matchAll(/\b(?:formerly(?:\s+(?:named|called|known as))?|previously\s+(?:named|called|known as)|also known as|a\.k\.a\.?|aka)\s+([^.;\n()]+)/gi)) {
    const name = clean(m[1]).replace(/^["'“]|["'”]$/g, "").trim();
    if (name && name.length <= 80) found.add(name);
  }
  return [...found];
}

export async function loadDirectory(supabase: SupabaseClient, selfId: string): Promise<Directory> {
  const [facilities, residents, contacts, residentLinks, facilityLinks, staff] = await Promise.all([
    supabase.from("facilities").select("id, name, city, active, notes").order("name"),
    supabase
      .from("residents")
      .select("id, first_name, last_name, preferred_name, current_facility_id, room_number, status")
      .order("last_name"),
    supabase.from("contacts").select("id, name, contact_type, organization, active").order("name"),
    supabase.from("resident_contacts").select("resident_id, contact_id, relationship_to_resident").eq("active", true),
    supabase.from("facility_contacts").select("facility_id, contact_id, role_at_facility").eq("active", true),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
  ]);

  const failed = [facilities, residents, contacts, residentLinks, facilityLinks, staff].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const idFor = new Map<string, string>();
  const nameFor = new Map<string, string>();
  const aliasOf = new Map<string, string>();
  const register = (prefix: string, index: number, id: string, name: string) => {
    const alias = `${prefix}${index + 1}`;
    idFor.set(alias, id);
    aliasOf.set(id, alias);
    nameFor.set(id, name);
    return alias;
  };

  const lines: string[] = [];

  lines.push("FACILITIES (alias | name | city | old names | inactive?)");
  (facilities.data as FacilityRow[]).forEach((f, i) => {
    const alias = register("F", i, f.id, f.name);
    const old = formerNames(f.notes);
    lines.push(
      [alias, clean(f.name), clean(f.city), old.length ? `formerly ${old.join(" / ")}` : "", f.active ? "" : "INACTIVE"]
        .filter(Boolean)
        .join(" | ")
    );
  });

  lines.push("", "RESIDENTS (alias | name | facility alias | room | status)");
  (residents.data as ResidentRow[]).forEach((r, i) => {
    const display = residentName(r);
    const alias = register("R", i, r.id, display);
    const name =
      r.preferred_name && r.preferred_name !== r.first_name
        ? `${clean(r.first_name)} "${clean(r.preferred_name)}" ${clean(r.last_name)}`.trim()
        : `${clean(r.first_name)} ${clean(r.last_name)}`.trim();
    const facility = r.current_facility_id ? aliasOf.get(r.current_facility_id) ?? "" : "";
    lines.push([alias, name, facility, r.room_number ? `room ${clean(r.room_number)}` : "", r.status].join(" | "));
  });

  const residentTies = new Map<string, string[]>();
  for (const link of residentLinks.data as ResidentLinkRow[]) {
    const resident = aliasOf.get(link.resident_id);
    if (!resident) continue;
    const list = residentTies.get(link.contact_id) ?? [];
    list.push(`${link.relationship_to_resident} of ${resident}`);
    residentTies.set(link.contact_id, list);
  }
  const facilityTies = new Map<string, string[]>();
  for (const link of facilityLinks.data as FacilityLinkRow[]) {
    const facility = aliasOf.get(link.facility_id);
    if (!facility) continue;
    const list = facilityTies.get(link.contact_id) ?? [];
    list.push(`${link.role_at_facility ? clean(link.role_at_facility) : "staff"} at ${facility}`);
    facilityTies.set(link.contact_id, list);
  }

  lines.push("", "CONTACTS (alias | name | type | organization | ties to residents/facilities | inactive?)");
  (contacts.data as ContactRow[]).forEach((c, i) => {
    const alias = register("C", i, c.id, c.name);
    const ties = [...(residentTies.get(c.id) ?? []), ...(facilityTies.get(c.id) ?? [])].join("; ");
    lines.push(
      [alias, clean(c.name), c.contact_type, clean(c.organization), ties, c.active ? "" : "INACTIVE"].join(" | ")
    );
  });

  lines.push("", "STAFF (alias | name)");
  let selfAlias: string | null = null;
  (staff.data as StaffRow[]).forEach((s, i) => {
    const alias = register("S", i, s.id, s.full_name);
    if (s.id === selfId) selfAlias = alias;
    lines.push(`${alias} | ${clean(s.full_name)}${s.id === selfId ? " (the person writing this note)" : ""}`);
  });

  const residentList = (residents.data as ResidentRow[]).map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    facility_id: r.current_facility_id,
  }));

  return { text: lines.join("\n"), idFor, nameFor, selfAlias, residents: residentList };
}
