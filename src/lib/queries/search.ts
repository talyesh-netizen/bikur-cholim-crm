import { createClient } from "@/lib/supabase/server";
import { searchWords, everyWordInAny } from "@/lib/supabase-filters";
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
  // Each word on its own, in any column: "Jacobs", "Ruth Jacobs" and
  // "jacobs ruth" all find Ruth Jacobs.
  const words = searchWords(query);
  if (words.length === 0) return { residents: [], facilities: [], contacts: [], organizations: [] };

  let residents = supabase
    .from("residents")
    .select("id, first_name, last_name, preferred_name, current_facility_id, facilities(name)")
    .limit(RESULTS_PER_GROUP);
  const nameMatch = everyWordInAny(words, ["first_name", "last_name", "preferred_name"]);
  if (nameMatch) residents = residents.or(nameMatch);
  let facilities = supabase.from("facilities").select("id, name, city").limit(RESULTS_PER_GROUP);
  let contacts = supabase.from("contacts").select("id, name, contact_type").limit(RESULTS_PER_GROUP);
  let organizations = supabase.from("organizations").select("id, name, organization_type").limit(RESULTS_PER_GROUP);
  for (const w of words) {
    facilities = facilities.ilike("name", `%${w}%`);
    contacts = contacts.ilike("name", `%${w}%`);
    organizations = organizations.ilike("name", `%${w}%`);
  }

  const [residentRows, facilityRows, contactRows, organizationRows] = await Promise.all([
    residents, facilities, contacts, organizations,
  ]);

  return {
    residents: (residentRows.data ?? []).map((r) => {
      const facility = r.facilities as unknown as { name: string } | null;
      return {
        id: r.id,
        label: residentName(r),
        sublabel: facility?.name ?? null,
        href: `/residents/${r.id}`,
      };
    }),
    facilities: (facilityRows.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      sublabel: f.city,
      href: `/facilities/${f.id}`,
    })),
    contacts: (contactRows.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: labelFor(CONTACT_TYPES, c.contact_type),
      href: `/contacts/${c.id}`,
    })),
    organizations: (organizationRows.data ?? []).map((o) => ({
      id: o.id,
      label: o.name,
      sublabel: o.organization_type ? labelFor(ORGANIZATION_TYPES, o.organization_type) : null,
      href: `/organizations/${o.id}`,
    })),
  };
}
