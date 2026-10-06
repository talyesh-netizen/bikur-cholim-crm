import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { labelFor, FACILITY_TYPES } from "@/lib/domain/facility";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { formatRelative } from "@/lib/format-date";
import { ChevronRight } from "lucide-react";
import { NO_CATEGORY_COLOR } from "@/lib/category-colors";

export function FacilityCard({ facility, areaColor }: { facility: FacilityWithSummary; areaColor?: string }) {
  const lastVisit = formatRelative(facility.last_visit_at);
  const details = [
    labelFor(FACILITY_TYPES, facility.facility_type),
    facility.city,
    `${facility.active_resident_count} resident${facility.active_resident_count === 1 ? "" : "s"}`,
    lastVisit ? `last contact ${lastVisit}` : "nothing logged yet",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/facilities/${facility.id}`} className="group block">
      <Card
        className="overflow-hidden border-l-4 transition-colors group-hover:border-primary/50"
        style={{ borderLeftColor: areaColor ?? NO_CATEGORY_COLOR }}
      >
        <CardContent className="flex items-center gap-3 px-4 py-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-base font-semibold leading-tight">{facility.name}</p>
              {!facility.active ? <StatusBadge tone="muted">Inactive</StatusBadge> : null}
              {facility.visit_priority === "high" ? <PriorityBadge priority="high" /> : null}
            </div>
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: areaColor ?? NO_CATEGORY_COLOR }} />
              <span className="truncate font-medium">{facility.geographic_cluster_name ?? "No area set"}</span>
            </p>
            <p className="truncate text-sm text-muted-foreground">{details}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
