/**
 * The one way a typed facility name is matched (decided Oct 9, 2026),
 * shared by every facility picker so they all find the same places.
 *
 * Forgiving on purpose -- people type what they remember:
 *   "lander"          -> Advanced Healthcare of Landerhaven  (start of any word)
 *   "landerhaven"     -> "Lander Haven" too                  (spaces ignored)
 *   "ej chagrin"      -> Eliza Jennings Chagrin Falls        (initials)
 *   "rose beachwood"  -> The Rose at Beachwood               (any order)
 *   "saint joseph"    -> St Joseph Center                    (St/Saint, Mt/Mount, HC...)
 *   "beachwood"       -> also by city or healthcare group
 * Small words ("the", "of", "at", "and") are skipped unless that's all
 * that was typed.
 */

export type MatchableFacility = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  zip?: string | null;
  parent_healthcare_group?: string | null;
};

const SMALL_WORDS = new Set(["the", "of", "at", "and", "a", "in", "on"]);

// Spelled either way in names and in what people type.
const SAME_WORD: Record<string, string> = {
  saint: "st",
  mount: "mt",
  hc: "healthcare",
  rehabilitation: "rehab",
  ctr: "center",
  centre: "center",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const plainWords = (text: string) => normalize(text).split(" ").filter(Boolean);

/** A name's words, plus the other spelling of any that has one -- so
 * "Saint Therese" is found by "st", "saint" and "sain" alike. */
const nameWordsOf = (text: string) => {
  const words = plainWords(text);
  return [...words, ...words.filter((w) => SAME_WORD[w]).map((w) => SAME_WORD[w])];
};

function initials(words: string[]): string {
  return words.filter((w) => !SMALL_WORDS.has(w)).map((w) => w[0]).join("");
}

export function typedWords(query: string): string[] {
  const all = plainWords(query).map((w) => SAME_WORD[w] ?? w);
  const meaningful = all.filter((w) => !SMALL_WORDS.has(w));
  return meaningful.length > 0 ? meaningful : all;
}

/** 0 = best. Null when it doesn't match. */
function score(f: MatchableFacility, typed: string[], compactQuery: string): number | null {
  const nameWords = nameWordsOf(f.name);
  const otherWords = nameWordsOf([f.city, f.address, f.zip, f.parent_healthcare_group].filter(Boolean).join(" "));
  const original = plainWords(f.name);
  const compactName = original.join("");
  const nameInitials = initials(original);

  if (compactQuery && compactName.startsWith(compactQuery)) return 0;

  let onlyName = true;
  for (const w of typed) {
    if (nameWords.some((n) => n.startsWith(w))) continue;
    if (w.length >= 3 && compactName.includes(w)) continue;
    if (w.length >= 2 && nameInitials.startsWith(w)) continue;
    if (otherWords.some((n) => n.startsWith(w))) {
      onlyName = false;
      continue;
    }
    return null;
  }
  return onlyName ? 1 : 2;
}

/** Facilities matching what was typed, best first; everything (A to Z)
 * when nothing is typed. */
export function matchFacilities<F extends MatchableFacility>(facilities: F[], query: string, limit?: number): F[] {
  const typed = typedWords(query);
  let result: F[];
  if (typed.length === 0) {
    result = [...facilities].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const compactQuery = typed.join("");
    result = facilities
      .map((f) => ({ f, s: score(f, typed, compactQuery) }))
      .filter((x): x is { f: F; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || a.f.name.localeCompare(b.f.name))
      .map((x) => x.f);
  }
  return limit ? result.slice(0, limit) : result;
}
