import type { FocusEvent } from "react";

/**
 * Capitalizes the first letter of each word in a name-like field,
 * leaving the rest of each word exactly as typed -- so "McDonald" or
 * "O'Brien" typed correctly are never mangled the way a full
 * lowercase-then-title-case pass would mangle them. Meant to be
 * applied on blur (see capitalizeOnBlur), not while typing, so it
 * never fights the cursor mid-word.
 */
export function capitalizeWords(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/** onBlur handler for a name-like <Input> -- capitalizes in place on
 * an uncontrolled field. */
export function capitalizeOnBlur(e: FocusEvent<HTMLInputElement>) {
  const capitalized = capitalizeWords(e.target.value);
  if (capitalized !== e.target.value) e.target.value = capitalized;
}
