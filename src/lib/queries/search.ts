import { createClient } from "@/lib/supabase/server";
import { escapeIlikeTerm, sanitizeForOrFilter } from "@/lib/supabase-filters";
import { residentName } from "@/lib/domain/resident-name";
import { CONTACT_TYPES, labelFor } from "@/lib/domain/contact";
import { ORGANIZATION_TYPES } from "@/lib/domain/organization";

export type SearchResult = {
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
};

export type SearchResults = {
  residents: SearchResult[];
  facilities: SearchResult[];
  contacts: SearchResult[];
  organizations: SearchResult[];
};

const RESULTS_PER_GROUP = 10;

/** Simple name search across the four main entity types, for the
 * global search bar -- not a replacement for each page's own filtered
 * list, just a fast "take me there" across the whole app. */
export async function searchAll(query: string): Promise<SearchResults> {
  const supabase = await createClient();
  const term = `%${escapeIlikeTerm(query)}%`;
  const cleaned = sanitizeForOrFilter(query);
  const orTerm = `%${escapeIlikeTerm(cleaned)}%`;
  // "Joan B" or "Joan Boyko": first word starts the first name, the rest
  // starts the last name -- names are stored in two columns, so a plain
  // match on either column alone never finds a typed full name.
  const words = cleaned.split(/\s+/).filter(Boolean);
  const fullName =
    words.length >= 2
      ? `,and(first_name.ilike.${escapeIlikeTerm(words[0])}%,last_name.ilike.${escapeIlikeTerm(words.slice(1).join(" "))}%)` +
        `,and(preferred_name.ilike.${escapeIlikeTerm(words[0])}%,last_name.ilike.${escapeIlikeTerm(words.slice(1).join(" "))}%)`
      : "";

  const [residents, facilities, contacts, organizations] = await Promise.all([
    supabase
      .from("residents")
      .select("id, first_name, last_name, preferred_name, current_facility_id, facilities(name)")
      .or(`first_name.ilike.${orTerm},last_name.ilike.${orTerm},preferred_name.ilike.${orTerm}${fullName}`)
      .limit(RESULTS_PER_GROUP),
    supabase.from("facilities").select("id, name, city").ilike("name", term).limit(RESULTS_PER_GROUP),
    supabase
      .from("contacts")
      .select("id, name, contact_type")
      .ilike("name", term)
      .limit(RESULTS_PER_GROUP),
    supabase.from("organizations").select("id, name, organization_type").ilike("name", term).limit(RESULTS_PER_GROUP),
  ]);

  return {
    residents: (residents.data ?? []).map((r) => {
      const facility = r.facilities as unknown as { name: string } | null;
      return {
        id: r.id,
        label: residentName(r),
        sublabel: facility?.name ?? null,
        href: `/residents/${r.id}`,
      };
    }),
    facilities: (facilities.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      sublabel: f.city,
      href: `/facilities/${f.id}`,
    })),
    contacts: (contacts.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: labelFor(CONTACT_TYPES, c.contact_type),
      href: `/contacts/${c.id}`,
    })),
    organizations: (organizations.data ?? []).map((o) => ({
      id: o.id,
      label: o.name,
      sublabel: o.organization_type ? labelFor(ORGANIZATION_TYPES, o.organization_type) : null,
      href: `/organizations/${o.id}`,
    })),
  };
}
