import { createClient } from "@/lib/supabase/server";
import { HEALTHCARE_GROUP, type Organization, type OrganizationContact } from "@/lib/domain/organization";
import type { Contact } from "@/lib/domain/contact";
import { escapeIlikeTerm, searchWords } from "@/lib/supabase-filters";

export type OrganizationFilters = {
  /** Strategic Partners (the Jewish community) or healthcare groups. */
  world?: "partners" | "healthcare";
  search?: string;
  organizationType?: string;
  showInactive?: boolean;
};

export async function listOrganizations(filters: OrganizationFilters = {}) {
  const supabase = await createClient();

  let query = supabase.from("organizations").select("*").order("name", { ascending: true });

  if (!filters.showInactive) {
    query = query.eq("active", true);
  }
  if (filters.world === "healthcare") {
    query = query.eq("organization_type", HEALTHCARE_GROUP);
  } else if (filters.world === "partners") {
    query = query.neq("organization_type", HEALTHCARE_GROUP);
  }
  if (filters.organizationType) {
    query = query.eq("organization_type", filters.organizationType);
  }
  if (filters.search) {
    for (const word of searchWords(filters.search)) {
      query = query.ilike("name", `%${word}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Organization[];
}

export async function getOrganization(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("*").eq("id", id).single();
  if (error) return null;
  return data as Organization;
}

/** Lightweight {id, name} options for pickers (e.g. linking a contact
 * to an organization). */
export async function listOrganizationOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}

export async function listOrganizationContacts(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_contacts")
    .select("id, organization_id, contact_id, role_at_organization, is_primary_contact, active, contacts(*)")
    .eq("organization_id", organizationId)
    .order("active", { ascending: false })
    .order("is_primary_contact", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    contact_id: row.contact_id,
    role_at_organization: row.role_at_organization,
    is_primary_contact: row.is_primary_contact,
    active: row.active,
    contact: row.contacts as unknown as Contact,
  })) as OrganizationContact[];
}

/** The organization a given contact is linked to, if any -- shown on
 * the contact's own page. */
export async function getOrganizationForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_contacts")
    .select("id, role_at_organization, is_primary_contact, organizations(id, name, organization_type)")
    .eq("contact_id", contactId)
    .eq("active", true)
    .order("is_primary_contact", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const organization = data.organizations as unknown as { id: string; name: string; organization_type: string } | null;
  return {
    organization_contact_id: data.id,
    role_at_organization: data.role_at_organization,
    is_primary_contact: data.is_primary_contact,
    organization_id: organization?.id ?? null,
    organization_name: organization?.name ?? "Unknown organization",
    organization_type: organization?.organization_type ?? null,
  };
}

/** The facilities a healthcare group owns: facilities whose "parent
 * healthcare group" is this group's name (any capitalization). */
export async function listFacilitiesOwnedBy(groupName: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, city, active")
    .ilike("parent_healthcare_group", escapeIlikeTerm(groupName.trim()))
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; city: string | null; active: boolean }[];
}

/** How many facilities each healthcare group owns, keyed by lowercased
 * group name, for the groups list. */
export async function facilityCountsByGroup(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facilities").select("parent_healthcare_group").not("parent_healthcare_group", "is", null);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const f of data ?? []) {
    const key = (f.parent_healthcare_group as string).trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** The healthcare group record named on a facility, if there is one --
 * so "Owned by Vitalia" can link to Vitalia's page. */
export async function findHealthcareGroup(name: string | null | undefined) {
  if (!name?.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("organization_type", HEALTHCARE_GROUP)
    .ilike("name", escapeIlikeTerm(name.trim()))
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}
