import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ClusterBadge } from "@/components/cluster-badge";
import { MissingNameBadge, ResidentStatusBadge } from "@/components/status-badge";
import type { ResidentWithSummary } from "@/lib/domain/resident";
import { clusterColor } from "@/lib/domain/cluster-colors";
import { formatDateOnly, formatRelative } from "@/lib/format-date";
import { ChevronRight } from "lucide-react";
import { residentName } from "@/lib/domain/resident-name";

function residenceUnitLabel(facilityType: string | null) {
  return facilityType === "assisted_living" || facilityType === "independent_living" || facilityType === "senior_apartment" ? "Apt" : "Room";
}

export function ResidentCard({ resident }: { resident: ResidentWithSummary }) {
  const displayName = residentName(resident);
  const lastVisit = formatRelative(resident.last_visit_at);
  const nextFollowUp = formatDateOnly(resident.next_follow_up_date);

  return (
    <Link href={`/residents/${resident.id}`} className="group block">
      <Card
        className="border-l-4 transition-colors group-hover:border-primary/50"
        style={{ borderLeftColor: clusterColor(resident.current_facility_cluster_id) }}
      >
        <CardContent className="flex items-center gap-3 p-4 sm:p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-base font-semibold leading-tight">{displayName}</p>
              <MissingNameBadge resident={resident} />
              {resident.status !== "active" ? <ResidentStatusBadge status={resident.status} /> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <ClusterBadge
                clusterId={resident.current_facility_cluster_id}
                name={resident.current_facility_name ?? "Current location unknown"}
              />
              {resident.room_number ? <span>{residenceUnitLabel(resident.current_facility_type)} {resident.room_number}</span> : null}
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span>{lastVisit ? `Last visit: ${lastVisit}` : "No visits logged yet"}</span>
              {nextFollowUp ? <span>Follow-up: {nextFollowUp}</span> : null}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
