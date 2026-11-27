import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { labelFor, FACILITY_TYPES } from "@/lib/domain/facility";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { StatusBadge } from "@/components/status-badge";
import { formatRelative } from "@/lib/format-date";
import { ChevronRight } from "lucide-react";
import { NO_CATEGORY_COLOR } from "@/lib/category-colors";

/** One facility on the list (Nov 27, 2026): name, type, area, active
 * status, residents on file and the last staff visit (in person,
 * confirmed), with the last contact of any kind beside it when newer. */
export function FacilityCard({
  facility,
  areaColor,
  lastStaffVisitAt,
}: {
  facility: FacilityWithSummary;
  areaColor?: string;
  lastStaffVisitAt?: string | null;
}) {
  const staffVisit = formatRelative(lastStaffVisitAt ?? null);
  const contact = formatRelative(facility.last_visit_at);
  const showContact = !!facility.last_visit_at && facility.last_visit_at !== lastStaffVisitAt && (!lastStaffVisitAt || facility.last_visit_at > lastStaffVisitAt);
  const color = areaColor ?? NO_CATEGORY_COLOR;

  return (
    <Link href={`/facilities/${facility.id}`} className="group block">
      <Card className="overflow-hidden border-l-4 transition-colors group-hover:border-primary/50" style={{ borderLeftColor: color }}>
        <CardContent className="flex items-center gap-3 px-4 py-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="min-w-0 break-words text-base font-semibold leading-tight [overflow-wrap:anywhere]">{facility.name}</p>
              {!facility.active ? <StatusBadge tone="muted">Inactive</StatusBadge> : null}
            </div>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
              >
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate">{facility.geographic_cluster_name ?? "No area set"}</span>
              </span>
              <span className="text-muted-foreground">{labelFor(FACILITY_TYPES, facility.facility_type)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {facility.active_resident_count} active resident{facility.active_resident_count === 1 ? "" : "s"} on file ·{" "}
              <span className={staffVisit ? "" : "font-medium text-[var(--tone-attention-fg)]"}>
                {staffVisit ? `last staff visit ${staffVisit}` : "no staff visit logged in the last year"}
              </span>
              {showContact ? ` · last contact ${contact}` : ""}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
