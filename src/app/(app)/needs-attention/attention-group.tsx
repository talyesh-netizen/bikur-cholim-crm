import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionResident } from "@/lib/queries/needs-attention";
import { residentName } from "@/lib/domain/resident-name";
import { ChevronRight } from "lucide-react";

const SHOW_AT_MOST = 25;

export function AttentionGroup({
  title,
  explanation,
  residents,
  detail,
}: {
  title: string;
  explanation: string;
  residents: AttentionResident[];
  detail: (r: AttentionResident) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{residents.length}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{explanation}</p>
      </CardHeader>
      <CardContent>
        {residents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody right now.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {residents.slice(0, SHOW_AT_MOST).map((r) => (
              <Link
                key={r.id}
                href={`/residents/${r.id}`}
                className="flex min-h-12 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-primary"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{residentName(r)}</p>
                  <p className="text-xs text-muted-foreground">{detail(r)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {residents.length > SHOW_AT_MOST ? (
              <p className="pt-2.5 text-sm text-muted-foreground">…and {residents.length - SHOW_AT_MOST} more.</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
