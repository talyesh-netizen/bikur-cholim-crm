import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { labelFor, FACILITY_TYPES } from "@/lib/domain/facility";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { ClusterBadge } from "@/components/cluster-badge";
import { EngagementBadge, PriorityBadge, StatusBadge } from "@/components/status-badge";
import { formatRelative } from "@/lib/format-date";
import { ChevronRight, MapPin, Users } from "lucide-react";

export function FacilityCard({ facility }: { facility: FacilityWithSummary }) {
  const lastVisit = formatRelative(facility.last_visit_at);

  return (
    <Link href={`/facilities/${facility.id}`} className="group block">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent className="flex items-center gap-3 p-4 sm:p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-base font-semibold leading-tight">{facility.name}</p>
              {!facility.active ? <StatusBadge tone="muted">Inactive</StatusBadge> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{labelFor(FACILITY_TYPES, facility.facility_type)}</span>
              {facility.city ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {facility.city}
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {facility.active_resident_count} resident{facility.active_resident_count === 1 ? "" : "s"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <EngagementBadge status={facility.engagement_status} />
              {facility.visit_priority === "high" ? <PriorityBadge priority="high" /> : null}
              {facility.geographic_cluster_name ? (
                <ClusterBadge clusterId={facility.geographic_cluster_id} name={facility.geographic_cluster_name} />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {lastVisit ? `Last visit: ${lastVisit}` : "No visits logged yet"}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
