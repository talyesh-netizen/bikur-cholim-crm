import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labelFor, RESIDENT_STATUSES } from "@/lib/domain/resident";
import type { ResidentWithSummary } from "@/lib/domain/resident";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import { Building2 } from "lucide-react";

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "active") return "success";
  if (status === "temporarily_hospitalized" || status === "unable_to_reach") return "warning";
  if (status === "deceased") return "secondary";
  if (status === "no_longer_receiving_services") return "destructive";
  return "secondary";
}

export function ResidentCard({ resident }: { resident: ResidentWithSummary }) {
  const displayName = resident.preferred_name
    ? `${resident.preferred_name} ${resident.last_name}`
    : `${resident.first_name} ${resident.last_name}`;
  const lastVisit = formatDateTime(resident.last_visit_at);
  const nextFollowUp = formatDateOnly(resident.next_follow_up_date);

  return (
    <Link href={`/residents/${resident.id}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{displayName}</p>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="size-3.5" />
                {resident.current_facility_name}
                {resident.room_number ? ` · Room ${resident.room_number}` : ""}
              </span>
            </div>
            <Badge variant={statusVariant(resident.status)}>
              {labelFor(RESIDENT_STATUSES, resident.status)}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{lastVisit ? `Last visit ${lastVisit}` : "No visits logged yet"}</span>
            {nextFollowUp ? <span>Next follow-up {nextFollowUp}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
