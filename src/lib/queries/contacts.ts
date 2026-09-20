import { createClient } from "@/lib/supabase/server";
import { CONTACT_QUICK_FILTERS } from "@/lib/domain/contact";
import type { Contact, ResidentContact, FacilityContact } from "@/lib/domain/contact";

export type ContactFilters = {
  search?: string;
  /** Either an exact contact_type, or one of CONTACT_QUICK_FILTERS' keys. */
  contactType?: string;
  showInactive?: boolean;
};

/** A contact plus its role at the facility it's primarily linked to (if
 * any) — shown on the contacts list so "Facility staff" isn't the only
 * thing visible; e.g. "Activities Director at Sunrise Manor". */
export type ContactListItem = Contact & {
  role_at_facility: string | null;
  facility_name: string | null;
};

export async function listContacts(filters: ContactFilters = {}): Promise<ContactListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("*, facility_contacts(role_at_facility, is_primary_contact, facilities(name))")
    .order("name", { ascending: true });

  if (!filters.showInactive) {
    query = query.eq("active", true);
  }
  if (filters.contactType) {
    const group = CONTACT_QUICK_FILTERS.find((g) => g.key === filters.contactType);
    query = group
      ? query.in("contact_type", group.types)
      : query.eq("contact_type", filters.contactType);
  }
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,organization.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { facility_contacts, ...contact } = row as Contact & {
      facility_contacts: { role_at_facility: string | null; is_primary_contact: boolean; facilities: { name: string } | null }[];
    };
    const links = facility_contacts ?? [];
    const primary = links.find((l) => l.is_primary_contact) ?? links[0] ?? null;
    return {
      ...contact,
      role_at_facility: primary?.role_at_facility ?? null,
      facility_name: primary?.facilities?.name ?? null,
    };
  });
}

/** Lightweight {id, name} options for pickers (interaction forms, etc.)
 * -- active contacts only, optionally narrowed to one contact_type
 * (e.g., "volunteer" for the "who was involved" checklist). */
export async function listContactOptions(contactType?: string) {
  const supabase = await createClient();
  let query = supabase.from("contacts").select("id, name").eq("active", true).order("name", { ascending: true });
  if (contactType) {
    query = query.eq("contact_type", contactType);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}

export async function getContact(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).single();
  if (error) return null;
  return data as Contact;
}

export async function listResidentContacts(residentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_contacts")
    .select(
      "id, resident_id, contact_id, relationship_to_resident, relationship_other_description, is_primary_contact, relationship_notes, active, contacts(*)"
    )
    .eq("resident_id", residentId)
    .order("active", { ascending: false })
    .order("is_primary_contact", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    resident_id: row.resident_id,
    contact_id: row.contact_id,
    relationship_to_resident: row.relationship_to_resident,
    relationship_other_description: row.relationship_other_description,
    is_primary_contact: row.is_primary_contact,
    relationship_notes: row.relationship_notes,
    active: row.active,
    contact: row.contacts as unknown as Contact,
  })) as ResidentContact[];
}

export async function listFacilityContacts(facilityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facility_contacts")
    .select("id, facility_id, contact_id, role_at_facility, is_primary_contact, active, contacts(*)")
    .eq("facility_id", facilityId)
    .order("active", { ascending: false })
    .order("is_primary_contact", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    facility_id: row.facility_id,
    contact_id: row.contact_id,
    role_at_facility: row.role_at_facility,
    is_primary_contact: row.is_primary_contact,
    active: row.active,
    contact: row.contacts as unknown as Contact,
  })) as FacilityContact[];
}

/** The facilities a given contact is linked to — shown on the contact's
 * own detail page (e.g., a regional director who oversees several
 * facilities). */
export async function listFacilitiesForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facility_contacts")
    .select("id, role_at_facility, is_primary_contact, facilities(id, name)")
    .eq("contact_id", contactId)
    .eq("active", true);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const facility = row.facilities as unknown as { id: string; name: string } | null;
    return {
      facility_contact_id: row.id,
      role_at_facility: row.role_at_facility,
      is_primary_contact: row.is_primary_contact,
      facility_id: facility?.id ?? null,
      facility_name: facility?.name ?? "Unknown facility",
    };
  });
}

/** The residents a given contact is linked to — shown on the contact's
 * own detail page (e.g., a rabbi who serves several residents). */
export async function listResidentsForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_contacts")
    .select("id, relationship_to_resident, is_primary_contact, residents(id, first_name, last_name, preferred_name)")
    .eq("contact_id", contactId)
    .eq("active", true);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const resident = row.residents as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
    return {
      resident_contact_id: row.id,
      relationship_to_resident: row.relationship_to_resident,
      is_primary_contact: row.is_primary_contact,
      resident_id: resident?.id ?? null,
      resident_name: resident
        ? `${resident.preferred_name ?? resident.first_name} ${resident.last_name}`
        : "Unknown resident",
    };
  });
}
