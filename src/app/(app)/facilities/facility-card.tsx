import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  labelFor,
  FACILITY_TYPES,
  ENGAGEMENT_STATUSES,
  VISIT_PRIORITIES,
} from "@/lib/domain/facility";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { formatDateTime } from "@/lib/format-date";
import { MapPin, Users } from "lucide-react";

function priorityVariant(priority: string): "destructive" | "warning" | "secondary" {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "warning";
  return "secondary";
}

function formatLastVisit(lastVisitAt: string | null) {
  const formatted = formatDateTime(lastVisitAt);
  return formatted ? `Last visit ${formatted}` : "No visits logged yet";
}

export function FacilityCard({ facility }: { facility: FacilityWithSummary }) {
  return (
    <Link href={`/facilities/${facility.id}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{facility.name}</p>
              <p className="text-sm text-muted-foreground">
                {labelFor(FACILITY_TYPES, facility.facility_type)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {!facility.active ? <Badge variant="outline">Inactive</Badge> : null}
              <Badge variant={priorityVariant(facility.visit_priority)}>
                {labelFor(VISIT_PRIORITIES, facility.visit_priority)} priority
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {facility.city ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {facility.city}
                {facility.geographic_cluster_name ? ` · ${facility.geographic_cluster_name}` : ""}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {facility.active_resident_count} active resident
              {facility.active_resident_count === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">
              {labelFor(ENGAGEMENT_STATUSES, facility.engagement_status)}
            </Badge>
            <span className="text-muted-foreground">
              {formatLastVisit(facility.last_visit_at)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
