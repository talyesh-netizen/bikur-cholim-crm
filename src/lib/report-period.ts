import { getLocalToday, nextDay, orgDayStartIso } from "@/lib/format-date";

/**
 * The period a report covers (director, Oct 21, 2026): any month, any
 * quarter, any year, or any range of days -- not only "this month / this
 * quarter". Days are Cleveland calendar days; `from` and `to` are both
 * included. Plain module (no database) so the page, the export and the
 * checks all read a period the same way.
 *
 * In a link: ?period=2026-Q3, ?period=2026-07, ?period=2026, or
 * ?from=2026-07-01&to=2026-09-30. The older ?period=month / quarter / all
 * still work and mean the current month / current quarter / all time.
 */
export type ReportPeriod = {
  /** What to put back in a link for this period ("2026-Q3", "all", "2026-07-01..2026-09-30"). */
  key: string;
  /** First day, or null for all time. */
  from: string | null;
  /** Last day (included), or null for all time. */
  to: string | null;
  /** "July–September 2026", "October 2026", "All time". */
  label: string;
  /** "month" / "quarter" / "year" / "period", for "vs last month"; null for all time. */
  word: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function lastDayOf(year: number, month: number): string {
  return `${year}-${pad2(month)}-${pad2(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
}

export function monthPeriod(year: number, month: number): ReportPeriod {
  return {
    key: `${year}-${pad2(month)}`,
    from: `${year}-${pad2(month)}-01`,
    to: lastDayOf(year, month),
    label: `${MONTHS[month - 1]} ${year}`,
    word: "month",
  };
}

export function quarterPeriod(year: number, quarter: number): ReportPeriod {
  const first = (quarter - 1) * 3 + 1;
  return {
    key: `${year}-Q${quarter}`,
    from: `${year}-${pad2(first)}-01`,
    to: lastDayOf(year, first + 2),
    label: `${MONTHS[first - 1]}–${MONTHS[first + 1]} ${year}`,
    word: "quarter",
  };
}

export function yearPeriod(year: number): ReportPeriod {
  return { key: String(year), from: `${year}-01-01`, to: `${year}-12-31`, label: String(year), word: "year" };
}

export const ALL_TIME: ReportPeriod = { key: "all", from: null, to: null, label: "All time", word: null };

function isRealDay(d: string): boolean {
  if (!DAY.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  return m >= 1 && m <= 12 && day >= 1 && day <= Number(lastDayOf(y, m).slice(8));
}

function formatDay(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${day}, ${y}`;
}

export function rangePeriod(from: string, to: string): ReportPeriod {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { key: `${a}..${b}`, from: a, to: b, label: `${formatDay(a)} – ${formatDay(b)}`, word: "period" };
}

/** Today's month and quarter in Cleveland. */
function today(): { year: number; month: number } {
  const [y, m] = getLocalToday().split("-").map(Number);
  return { year: y, month: m };
}

export function currentMonth(): ReportPeriod {
  const { year, month } = today();
  return monthPeriod(year, month);
}

export function currentQuarter(): ReportPeriod {
  const { year, month } = today();
  return quarterPeriod(year, Math.floor((month - 1) / 3) + 1);
}

/** Reads ?period= / ?from=&to=. Anything unreadable falls back. */
export function parsePeriod(
  params: { period?: string | null; from?: string | null; to?: string | null },
  fallback: () => ReportPeriod = currentQuarter
): ReportPeriod {
  const { period, from, to } = params;
  if (from && to && isRealDay(from) && isRealDay(to)) return rangePeriod(from, to);
  if (!period) return fallback();
  if (period === "all") return ALL_TIME;
  if (period === "month") return currentMonth();
  if (period === "quarter") return currentQuarter();
  let m = period.match(/^(\d{4})-Q([1-4])$/);
  if (m) return quarterPeriod(Number(m[1]), Number(m[2]));
  m = period.match(/^(\d{4})-(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return monthPeriod(Number(m[1]), Number(m[2]));
  m = period.match(/^(\d{4})$/);
  if (m) return yearPeriod(Number(m[1]));
  m = period.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (m && isRealDay(m[1]) && isRealDay(m[2])) return rangePeriod(m[1], m[2]);
  return fallback();
}

/** "?period=2026-Q3" -- the query string that reopens this period. */
export function periodQuery(p: ReportPeriod): string {
  return `period=${encodeURIComponent(p.key)}`;
}

/** The exact moments the period covers, as [start, end): midnight
 * Cleveland time on the first day, and midnight after the last day. Null
 * ends for all time. */
export function periodBounds(p: ReportPeriod): { start: string | null; end: string | null } {
  return {
    start: p.from ? orgDayStartIso(p.from) : null,
    end: p.to ? orgDayStartIso(nextDay(p.to)) : null,
  };
}

/** Whether a moment falls in the period. */
export function inPeriod(occurredAt: string, bounds: { start: string | null; end: string | null }): boolean {
  const t = Date.parse(occurredAt);
  if (bounds.start && t < Date.parse(bounds.start)) return false;
  if (bounds.end && t >= Date.parse(bounds.end)) return false;
  return true;
}

/** The same-length period just before (for "vs last quarter"): the
 * previous month / quarter / year, or the same number of days before a
 * custom range. Null for all time. */
export function previousPeriod(p: ReportPeriod): ReportPeriod | null {
  if (!p.from || !p.to) return null;
  const [y, m] = p.from.split("-").map(Number);
  if (p.word === "month") return m === 1 ? monthPeriod(y - 1, 12) : monthPeriod(y, m - 1);
  if (p.word === "quarter") {
    const q = Math.floor((m - 1) / 3) + 1;
    return q === 1 ? quarterPeriod(y - 1, 4) : quarterPeriod(y, q - 1);
  }
  if (p.word === "year") return yearPeriod(y - 1);
  const days = Math.round((Date.parse(`${p.to}T00:00:00Z`) - Date.parse(`${p.from}T00:00:00Z`)) / 86400000) + 1;
  const end = new Date(Date.parse(`${p.from}T00:00:00Z`) - 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return rangePeriod(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
}

/** The months a period touches, oldest first (for monthly bars): the
 * period's own months (at most the last 24), or the last `fallback`
 * months for all time. */
export function monthsOf(p: ReportPeriod, fallback = 6): ReportPeriod[] {
  const { year, month } = today();
  const index = (d: string) => {
    const [y, m] = d.split("-").map(Number);
    return y * 12 + (m - 1);
  };
  const last = p.to ? index(p.to) : year * 12 + (month - 1);
  const first = p.from ? Math.max(index(p.from), last - 23) : last - (fallback - 1);
  const out: ReportPeriod[] = [];
  for (let i = first; i <= last; i++) out.push(monthPeriod(Math.floor(i / 12), (i % 12) + 1));
  return out;
}

/** The choices a period picker offers: the usual ones by name (as real
 * periods, so "Last quarter" lights up for 2026-Q3 too), plus the last
 * 24 months and 8 quarters. */
export function periodChoices(): {
  quick: { key: string; label: string }[];
  months: { key: string; label: string }[];
  quarters: { key: string; label: string }[];
} {
  const month = currentMonth();
  const quarter = currentQuarter();
  const { year } = today();
  const quick = [
    { key: month.key, label: "This month" },
    { key: previousPeriod(month)!.key, label: "Last month" },
    { key: quarter.key, label: "This quarter" },
    { key: previousPeriod(quarter)!.key, label: "Last quarter" },
    { key: String(year), label: "This year" },
    { key: ALL_TIME.key, label: "All time" },
  ];
  const months: { key: string; label: string }[] = [];
  let m: ReportPeriod = month;
  for (let i = 0; i < 24; i++) {
    months.push({ key: m.key, label: m.label });
    m = previousPeriod(m)!;
  }
  const quarters: { key: string; label: string }[] = [];
  let q: ReportPeriod = quarter;
  for (let i = 0; i < 8; i++) {
    quarters.push({ key: q.key, label: `${q.label} (Q${q.key.slice(-1)})` });
    q = previousPeriod(q)!;
  }
  return { quick, months, quarters };
}
