import { ORGANIZATION_TIMEZONE } from "@/lib/config";

/**
 * Helpers for treating a plain calendar day ("2026-09-25") as the
 * organization's own day in America/New_York, not the server's UTC day.
 *
 * A "day" in Cleveland starts at local midnight, which is 04:00 UTC in
 * summer and 05:00 UTC in winter -- and the two days a year the clocks
 * change are 23 or 25 hours long. Anything that asks "what happened on
 * this day?" (the daily summary, later reporting and route planning)
 * should use these bounds instead of UTC midnight, or late-evening
 * activity lands on the wrong day.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** "2026-09-25" shifted by whole calendar days (negative for earlier). */
export function shiftIsoDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** How far the org's clock is from UTC at a given moment, in ms
 * (e.g. -4h during daylight time, -5h during standard time). */
function offsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORGANIZATION_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The exact moment local midnight begins on a given org calendar day. */
function localMidnight(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day);
  // First guess uses the offset at UTC midnight; the second pass
  // re-reads the offset at the guessed moment so a DST change between
  // the two can't leave the boundary an hour off.
  const firstGuess = wallClock - offsetMs(new Date(wallClock));
  return new Date(wallClock - offsetMs(new Date(firstGuess)));
}

/** [start, end) of an org calendar day as ISO timestamps -- query with
 * `.gte(column, start).lt(column, end)` so nothing on the boundary is
 * counted twice or dropped. */
export function orgDayBounds(value: string): { start: string; end: string } {
  return {
    start: localMidnight(value).toISOString(),
    end: localMidnight(shiftIsoDate(value, 1)).toISOString(),
  };
}

/** "3:45 PM" in the org's time zone, regardless of where the server runs. */
export function formatOrgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: ORGANIZATION_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Friday, September 25, 2026" for a plain calendar day. Formatted at
 * UTC noon so no time-zone conversion can roll it to a neighboring day. */
export function formatDayHeading(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
