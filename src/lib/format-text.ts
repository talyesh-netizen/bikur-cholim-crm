import type { ChangeEvent } from "react";

/**
 * Capitalizes the first letter of each word in a name-like field,
 * leaving the rest of each word exactly as typed -- so "McDonald" or
 * "O'Brien" typed correctly are never mangled the way a full
 * lowercase-then-title-case pass would mangle them. A "word" starts at
 * any letter not preceded by another letter, so accented letters inside
 * a word ("José") are left alone. Short joining words ("of", "at",
 * "the"...) stay lowercase unless they come first, so a facility name
 * reads "Heritage of Lyndhurst", not "Heritage Of Lyndhurst".
 */
const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

export function capitalizeWords(value: string): string {
  return value.replace(/(?<![\p{L}\p{M}])\p{L}[\p{L}\p{M}]*/gu, (word, offset: number) =>
    offset > 0 && SMALL_WORDS.has(word.toLowerCase())
      ? word.toLowerCase()
      : word.charAt(0).toUpperCase() + word.slice(1)
  );
}

/** onChange handler for a name-like <Input>: capitalizes each word as
 * it's typed, keeping the cursor where it was (capitalizing never
 * changes the length, so the positions still line up). */
export function capitalizeAsYouType(e: ChangeEvent<HTMLInputElement>) {
  const input = e.target;
  const capitalized = capitalizeWords(input.value);
  if (capitalized === input.value) return;
  const { selectionStart, selectionEnd } = input;
  input.value = capitalized;
  if (selectionStart !== null && selectionEnd !== null) input.setSelectionRange(selectionStart, selectionEnd);
}

/** capitalizeWords for an optional field -- passes empty values
 * through untouched. Used server-side so a name typed and submitted
 * with Enter (which skips the blur) is still saved capitalized. */
export function capitalizeOptional<T extends string | null | undefined>(value: T): T {
  return (typeof value === "string" ? capitalizeWords(value) : value) as T;
}
