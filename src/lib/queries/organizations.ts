import { createClient } from "@/lib/supabase/server";
import type { Organization, OrganizationContact } from "@/lib/domain/organization";
import type { Contact } from "@/lib/domain/contact";

export type OrganizationFilters = {
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
  if (filters.organizationType) {
    query = query.eq("organization_type", filters.organizationType);
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
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
    .select("id, organization_id, contact_id, role_at_organization, is_primary_contact, contacts(*)")
    .eq("organization_id", organizationId)
    .order("is_primary_contact", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    contact_id: row.contact_id,
    role_at_organization: row.role_at_organization,
    is_primary_contact: row.is_primary_contact,
    contact: row.contacts as unknown as Contact,
  })) as OrganizationContact[];
}

/** The organization a given contact is linked to, if any -- shown on
 * the contact's own page. */
export async function getOrganizationForContact(contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_contacts")
    .select("id, role_at_organization, is_primary_contact, organizations(id, name)")
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const organization = data.organizations as unknown as { id: string; name: string } | null;
  return {
    organization_contact_id: data.id,
    role_at_organization: data.role_at_organization,
    is_primary_contact: data.is_primary_contact,
    organization_id: organization?.id ?? null,
    organization_name: organization?.name ?? "Unknown organization",
  };
}
