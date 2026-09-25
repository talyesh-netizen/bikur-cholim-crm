import { ORGANIZATION_TIMEZONE } from "@/lib/config";

/**
 * Everything date-related in the app is read in the organization's own
 * timezone (America/New_York), never the server's. Vercel runs in UTC,
 * so anything built from `new Date().getHours()`, `getDate()` etc. on the
 * server is up to five hours off from Cleveland -- enough to put an
 * evening visit on the wrong day. The helpers below are the only place
 * that converts between "a moment in time" (what the database stores)
 * and "a Cleveland calendar day / wall-clock time" (what people see and
 * type).
 */

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ORGANIZATION_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The Cleveland calendar date and wall-clock time of an exact moment. */
function zonedParts(date: Date): ZonedParts {
  const get = (type: string) => Number(partsFormatter.formatToParts(date).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09-22" for the org's own local calendar day, not the server's
 * -- used anywhere "today" is compared against a plain due_date, so a
 * task due "today" doesn't read as overdue for several hours of the
 * local business day. */
export function getLocalToday(): string {
  const p = zonedParts(new Date());
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The exact moment (as an ISO string) that a Cleveland wall-clock time
 * refers to -- e.g. "2026-09-22T19:30" typed into a date & time field
 * means 7:30pm in Cleveland, which is 23:30 UTC in the summer and 00:30
 * UTC the next day in the winter. Handles daylight-saving changes. */
export function orgLocalToIso(localDateTime: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(localDateTime);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map((v) => Number(v ?? 0));
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The offset depends on the date (daylight saving), so work it out at
  // the target moment, then re-check once in case the guess crossed a
  // DST boundary.
  const offsetAt = (ms: number) => {
    const p = zonedParts(new Date(ms));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  };
  let utcMs = wallClockAsUtc - offsetAt(wallClockAsUtc);
  const secondOffset = offsetAt(utcMs);
  if (wallClockAsUtc - secondOffset !== utcMs) utcMs = wallClockAsUtc - secondOffset;
  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

/** The start of a Cleveland calendar day ("2026-09-22") as an exact
 * moment -- for filtering timestamps by day ("on or after the 22nd"). */
export function orgDayStartIso(date: string): string | null {
  return orgLocalToIso(`${date}T00:00`);
}

/** The Cleveland calendar day after `date` ("2026-09-22" -> "2026-09-23"). */
export function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/** "2026-07-28T14:30" -- the Cleveland wall-clock time of a stored
 * timestamp, in the format <input type="datetime-local"> needs. Same
 * answer on the server and in the browser. */
export function toOrgDatetimeLocalValue(value: string | Date): string {
  const p = zonedParts(typeof value === "string" ? new Date(value) : value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** The first day of the current Cleveland month, `monthsBack` months
 * ago (0 = this month), as { year, month } with month 1-12. */
export function orgMonthStart(monthsBack = 0): { year: number; month: number } {
  const p = zonedParts(new Date());
  const index = p.year * 12 + (p.month - 1) - monthsBack;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "2026-09" -- the Cleveland month an exact moment falls in. */
export function orgMonthKey(value: string): string {
  const p = zonedParts(new Date(value));
  return `${p.year}-${pad(p.month)}`;
}

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
    timeZone: ORGANIZATION_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Like formatDateTime, plus the Cleveland time of day ("Sep 22, 2026, 7:30 PM"). */
export function formatDateTimeWithTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString("en-US", {
    timeZone: ORGANIZATION_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
 * lists), counted in Cleveland calendar days -- so something from last
 * night reads "Yesterday", not "Today" -- falling back to the plain date
 * once it's more than a week out. */
export function formatRelative(value: string | null | undefined): string | null {
  if (!value) return null;
  const then = zonedParts(new Date(value));
  const now = zonedParts(new Date());
  const days = Math.round(
    (Date.UTC(now.year, now.month - 1, now.day) - Date.UTC(then.year, then.month - 1, then.day)) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDateTime(value);
}
