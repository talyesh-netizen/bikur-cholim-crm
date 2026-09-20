import type { PersonImpactRow } from "@/lib/queries/impact";

/** Ranked list of "who did how much" for a period — used for both the
 * staff and volunteer impact panels on the dashboard, e.g. for funders
 * who want to see impact isn't just one person's work. */
export function ImpactLeaderboard({
  rows,
  emptyMessage,
  barColor,
}: {
  rows: PersonImpactRow[];
  emptyMessage: string;
  barColor: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count));

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium leading-tight">{row.name}</span>
            <span className="whitespace-nowrap tabular-nums text-muted-foreground">{row.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%`, backgroundColor: barColor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
