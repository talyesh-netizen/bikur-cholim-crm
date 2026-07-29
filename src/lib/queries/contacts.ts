import { createClient } from "@/lib/supabase/server";
import type { Contact, ResidentContact } from "@/lib/domain/contact";

export type ContactFilters = {
  search?: string;
  contactType?: string;
  showInactive?: boolean;
};

export async function listContacts(filters: ContactFilters = {}) {
  const supabase = await createClient();

  let query = supabase.from("contacts").select("*").order("name", { ascending: true });

  if (!filters.showInactive) {
    query = query.eq("active", true);
  }
  if (filters.contactType) {
    query = query.eq("contact_type", filters.contactType);
  }
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,organization.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
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
      "id, resident_id, contact_id, relationship_to_resident, relationship_other_description, is_primary_contact, relationship_notes, contacts(*)"
    )
    .eq("resident_id", residentId)
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
    contact: row.contacts as unknown as Contact,
  })) as ResidentContact[];
}

/** The residents a given contact is linked to — shown on the contact's
 * own detail page (e.g., a rabbi who serves several residents). */
export async function listResidentsForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_contacts")
    .select("id, relationship_to_resident, is_primary_contact, residents(id, first_name, last_name, preferred_name)")
    .eq("contact_id", contactId);

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
