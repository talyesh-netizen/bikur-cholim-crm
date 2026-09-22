import Link from "next/link";
import type { PersonImpactRow } from "@/lib/queries/impact";

/** Ranked list of "who did how much" for a period — used for both the
 * staff and volunteer impact panels on the dashboard, e.g. for funders
 * who want to see impact isn't just one person's work. */
export function ImpactLeaderboard({
  rows,
  emptyMessage,
  barColor,
  hrefFor,
}: {
  rows: PersonImpactRow[];
  emptyMessage: string;
  barColor: string;
  /** When given, each row opens this page (e.g. a volunteer's contact page). */
  hrefFor?: (row: PersonImpactRow) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count));

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li
          key={row.id}
          className={
            hrefFor
              ? "relative -mx-2 flex flex-col gap-1 rounded-md px-2 py-1 transition-colors hover:bg-muted/60"
              : "flex flex-col gap-1"
          }
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            {hrefFor ? (
              <Link href={hrefFor(row)} className="stretched-link font-medium leading-tight hover:underline">
                {row.name}
              </Link>
            ) : (
              <span className="font-medium leading-tight">{row.name}</span>
            )}
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
