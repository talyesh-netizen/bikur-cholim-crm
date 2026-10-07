/** The three weeks before and after today, one line per day, so "last
 * Thursday" or "next Monday" is looked up rather than counted. */
export function calendarAround(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const day = (offset: number) => new Date(Date.UTC(y, m - 1, d + offset));
  const label = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  const lines = [];
  for (let offset = -21; offset <= 21; offset++) {
    const date = day(offset);
    const tag = offset === 0 ? " (today)" : offset === -1 ? " (yesterday)" : offset === 1 ? " (tomorrow)" : "";
    lines.push(`${date.toISOString().slice(0, 10)} ${label(date)}${tag}`);
  }
  return `CALENDAR:\n${lines.join("\n")}`;
}
