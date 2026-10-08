/** Escapes the special `ilike` wildcard characters (`%`, `_`, and the
 * escape character itself, `\`) in free-text search input, so a name or
 * search term that happens to contain one of these doesn't silently act
 * as a wildcard and return surprising results. */
export function escapeIlikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** PostgREST's `.or()` filter strings are comma-separated lists of
 * `column.op.value` clauses, and parentheses group them -- so a raw
 * search value containing any of those breaks the syntax and crashes
 * the whole page instead of just searching for that text. Searching
 * "Cohen, Sarah" (a very common paste from a spreadsheet of names) is
 * exactly this case. PostgREST does support quoting a value to protect
 * reserved characters inside it, but this app has no way to verify that
 * quoting syntax against the live API from this sandbox, and getting it
 * wrong would break search for everyone rather than just people
 * searching with a comma -- so the safer fix is to drop the characters
 * that are structurally significant to the `.or()` parser instead of
 * trying to escape them. A search for "Cohen, Sarah" then behaves like
 * a search for "Cohen  Sarah" (still finds the right person) rather
 * than crashing. Only needed when building a `.or()` string by hand --
 * a plain `.ilike(column, value)` call doesn't need it. */
export function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, " ");
}

/** The separate words of a search, ready for `.or()` / `.ilike()`. Each
 * word is matched on its own, so "Ruth Jacobs", "Jacobs" and "jacobs
 * ruth" all find the same person -- first name, last name or both, in
 * any order. */
export function searchWords(value: string): string[] {
  return sanitizeForOrFilter(value).split(/\s+/).filter(Boolean).map(escapeIlikeTerm);
}

/** A single `.or()` filter meaning "every search word appears in at
 * least one of these columns" -- e.g. "Ruth Jacobs" matches first name
 * Ruth and last name Jacobs, in either order. Null when there are no
 * words. */
export function everyWordInAny(words: string[], columns: string[]): string | null {
  if (words.length === 0) return null;
  const perWord = words.map((w) => `or(${columns.map((c) => `${c}.ilike.%${w}%`).join(",")})`);
  return `and(${perWord.join(",")})`;
}
