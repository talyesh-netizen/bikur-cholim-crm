"use server";

import { searchAll, type SearchResult } from "@/lib/queries/search";

export type Suggestion = SearchResult & { kind: string };

// How many of each type the dropdown under the search box shows. The
// full results page (Enter) still shows up to 10 of each.
const PER_KIND = { residents: 4, facilities: 3, contacts: 3, organizations: 2 } as const;
const KIND_LABEL = { residents: "Resident", facilities: "Facility", contacts: "Contact", organizations: "Organization" } as const;

/** Suggestions for the global search box as the user types. Uses the
 * same search (and the same per-user access rules) as the results page. */
export async function searchSuggestions(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const results = await searchAll(q);
  return (Object.keys(PER_KIND) as (keyof typeof PER_KIND)[]).flatMap((k) =>
    results[k].slice(0, PER_KIND[k]).map((r) => ({ ...r, kind: KIND_LABEL[k] }))
  );
}
