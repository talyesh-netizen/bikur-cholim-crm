import { createClient } from "@/lib/supabase/server";

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
  const term = `%${query}%`;

  const [residents, facilities, contacts, organizations] = await Promise.all([
    supabase
      .from("residents")
      .select("id, first_name, last_name, preferred_name, current_facility_id, facilities(name)")
      .or(`first_name.ilike.${term},last_name.ilike.${term},preferred_name.ilike.${term}`)
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
        label: `${r.preferred_name ?? r.first_name} ${r.last_name}`,
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
      sublabel: c.contact_type,
      href: `/contacts/${c.id}`,
    })),
    organizations: (organizations.data ?? []).map((o) => ({
      id: o.id,
      label: o.name,
      sublabel: o.organization_type,
      href: `/organizations/${o.id}`,
    })),
  };
}
