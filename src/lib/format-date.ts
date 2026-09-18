/**
 * Two different-looking helpers for a reason: the database stores some
 * fields as a full timestamp ("2026-07-10T09:30:00Z" — an exact moment)
 * and others as a plain date ("2026-08-05" — a calendar day with no
 * time attached, like a due date). Formatting a plain date with
 * `new Date("2026-08-05")` interprets it as UTC midnight, which can
 * display as the PREVIOUS day once converted to a US timezone — a
 * classic off-by-one bug. formatDateOnly avoids that by reading the
 * year/month/day directly instead of going through a UTC conversion.
 */

export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A short, scannable "how long ago" label for a timestamp (dashboard
 * lists), falling back to the plain date once it's more than a week out
 * so old items don't show an ever-growing day count. */
export function formatRelative(value: string | null | undefined): string | null {
  if (!value) return null;
  const then = new Date(value);
  const days = Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDateTime(value);
}
