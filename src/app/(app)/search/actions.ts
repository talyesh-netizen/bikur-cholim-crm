"use server";

import { searchAll, type SearchResult } from "@/lib/queries/search";

export type Suggestion = SearchResult & { kind: string };

// The dropdown under the search box is a quick "take me there": a few
// of each kind, at most this many in all. Enter (or "See all results")
// opens the full, grouped results page.
const PER_KIND = 3;
const MAX_SUGGESTIONS = 10;

/** Suggestions for the global search box as the user types. Uses the
 * same search (and the same per-user access rules) as the results page. */
export async function searchSuggestions(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const groups = await searchAll(q);
  return groups
    .flatMap((g) => g.results.slice(0, PER_KIND).map((r) => ({ ...r, kind: g.kind })))
    .slice(0, MAX_SUGGESTIONS);
}
