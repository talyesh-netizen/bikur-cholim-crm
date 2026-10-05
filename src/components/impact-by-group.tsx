import type { GroupImpactRow } from "@/lib/queries/impact";

const COLUMNS: { key: keyof GroupImpactRow; label: string; hint?: string }[] = [
  { key: "facilities", label: "Facilities" },
  { key: "currentResidents", label: "Residents now", hint: "Active residents living there today" },
  { key: "residentsReached", label: "Residents reached", hint: "Different residents with at least one interaction in the period" },
  { key: "visits", label: "Visits & calls" },
  { key: "programs", label: "Programs" },
  { key: "food", label: "Food" },
  { key: "referrals", label: "Referrals & rides" },
  { key: "total", label: "All interactions" },
];

/** "Impact by healthcare group" table for the dashboard. Scrolls
 * sideways inside its own box on a phone, never the whole page. */
export function ImpactByGroupTable({ rows, notAtAFacility }: { rows: GroupImpactRow[]; notAtAFacility: number }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No facilities yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="min-w-[13rem] py-2 pr-3 font-medium">Healthcare group</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-right font-medium" title={c.hint}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.group} className="border-b border-border last:border-0">
                <td className={row.isUngrouped ? "py-2 pr-3 italic text-muted-foreground" : "py-2 pr-3 font-medium"}>{row.group}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                    {(row[c.key] as number).toLocaleString("en-US")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Groups come from each facility&apos;s &ldquo;parent healthcare group&rdquo;. Facilities without one are under &ldquo;No group recorded&rdquo;.
        {notAtAFacility > 0
          ? ` ${notAtAFacility.toLocaleString("en-US")} interaction${notAtAFacility === 1 ? " wasn't" : "s weren't"} tied to a facility (e.g. phone calls) and aren't counted here.`
          : ""}
      </p>
    </div>
  );
}
