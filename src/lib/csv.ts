/** Wraps a value in quotes (doubling any inner quotes) only when it
 * actually needs it -- commas, quotes, or line breaks -- so the common
 * case stays plain and readable if opened in a text editor. */
export function csvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(csvField).join(",") + "\r\n";
}

/** Marks a CSV file as UTF-8 for Excel, which otherwise garbles
 * accented and Hebrew characters when the file is double-clicked. */
export const UTF8_BOM = "﻿";
