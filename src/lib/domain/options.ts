/** Shared helper for the option-list pattern used across every domain
 * file in this folder (facility.ts, resident.ts, etc.): a stored
 * database code paired with a plain-English label. */
export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}
