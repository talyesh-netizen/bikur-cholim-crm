import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { MissingNameBadge, ResidentStatusBadge } from "@/components/status-badge";
import type { ResidentWithSummary } from "@/lib/domain/resident";
import { clusterColor } from "@/lib/domain/cluster-colors";
import { formatRelative } from "@/lib/format-date";
import { ChevronRight } from "lucide-react";
import { residentName } from "@/lib/domain/resident-name";

function residenceUnitLabel(facilityType: string | null) {
  return facilityType === "assisted_living" || facilityType === "independent_living" || facilityType === "senior_apartment" ? "Apt" : "Room";
}

export function ResidentCard({ resident }: { resident: ResidentWithSummary }) {
  const displayName = residentName(resident);
  const lastVisit = formatRelative(resident.last_visit_at);
  const details = [
    resident.current_facility_name ?? "Current location unknown",
    resident.room_number ? `${residenceUnitLabel(resident.current_facility_type)} ${resident.room_number}` : null,
    lastVisit ? `visited ${lastVisit}` : "no visits yet",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/residents/${resident.id}`} className="group block">
      <Card
        className="border-l-4 transition-colors group-hover:border-primary/50"
        style={{ borderLeftColor: clusterColor(resident.current_facility_cluster_id) }}
      >
        <CardContent className="flex items-center gap-3 px-4 py-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-base font-semibold leading-tight">{displayName}</p>
              {/* Only flag what needs noticing; plain "Active" goes unsaid. */}
              {resident.status !== "active" ? <ResidentStatusBadge status={resident.status} /> : null}
              <MissingNameBadge resident={resident} />
            </div>
            <p className="truncate text-sm text-muted-foreground">{details}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
