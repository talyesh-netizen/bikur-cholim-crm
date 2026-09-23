import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateOnly } from "@/lib/format-date";
import type { VisitPartner } from "@/lib/queries/interactions";

/** "Who visits whom" summary for volunteer visits: on a resident's page it
 * lists their volunteers, on a volunteer's page the residents they visit. */
export function VisitPartnersCard({
  title,
  partners,
  hrefBase,
  emptyMessage,
}: {
  title: string;
  partners: VisitPartner[];
  hrefBase: "/contacts" | "/residents";
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} ({partners.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {partners.map((p) => (
              <li
                key={p.id}
                className="relative -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
              >
                <Link href={`${hrefBase}/${p.id}`} className="stretched-link font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {p.visitCount} visit{p.visitCount === 1 ? "" : "s"} · last {formatDateOnly(p.lastVisitAt.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
