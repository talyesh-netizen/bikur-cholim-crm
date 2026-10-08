/**
 * The short lists (decided with the director, Oct 8, 2026): each long
 * list keeps every value so older records still read correctly, but a
 * form only offers the few choices that are actually used. A record
 * that already has an older value keeps seeing it as a choice, so
 * editing it never silently changes it.
 */
export function offeredOptions<T extends { value: string; label: string }>(
  list: readonly T[],
  offered: readonly string[],
  current?: string | null
): T[] {
  return list.filter((o) => offered.includes(o.value) || o.value === current);
}
