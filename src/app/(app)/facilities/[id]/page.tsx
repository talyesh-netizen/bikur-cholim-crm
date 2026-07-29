import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFacility } from "@/lib/queries/facilities";
import { setFacilityActive } from "@/lib/actions/facilities";
import { listResidents } from "@/lib/queries/residents";
import { listInteractionsForFacility } from "@/lib/queries/interactions";
import {
  labelFor,
  FACILITY_TYPES,
  ENGAGEMENT_STATUSES,
  VISIT_PRIORITIES,
  KOSHER_FOOD_OPTIONS,
} from "@/lib/domain/facility";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { formatDateTime } from "@/lib/format-date";
import { InteractionList } from "@/app/(app)/interactions/interaction-list";
import { Pencil, Plus } from "lucide-react";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [facility, residents, interactions] = await Promise.all([
    getFacility(id),
    listResidents({ facilityId: id, showAllStatuses: true }),
    listInteractionsForFacility(id),
  ]);

  if (!facility) notFound();

  const toggleActive = setFacilityActive.bind(null, facility.id, !facility.active);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{facility.name}</h1>
            {!facility.active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {labelFor(FACILITY_TYPES, facility.facility_type)}
            {facility.city ? ` · ${facility.city}` : ""}
            {facility.geographic_cluster_name ? ` · ${facility.geographic_cluster_name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/interactions/new?facility=${facility.id}`}>
              <Plus className="size-4" />
              Log an interaction
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/facilities/${facility.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <form action={toggleActive}>
            <Button variant="outline" type="submit">
              {facility.active ? "Mark inactive" : "Mark active"}
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>{labelFor(ENGAGEMENT_STATUSES, facility.engagement_status)}</Badge>
        <Badge variant="secondary">
          {labelFor(VISIT_PRIORITIES, facility.visit_priority)} priority
        </Badge>
        {facility.jewish_residents_currently_known ? (
          <Badge variant="secondary">Jewish residents known</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="Address" value={formatAddress(facility)} />
            <InfoRow label="Main phone" value={facility.main_phone} />
            <InfoRow label="Website" value={facility.website} />
            <InfoRow label="Parent healthcare group" value={facility.parent_healthcare_group} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jewish resident engagement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow
              label="Approx. Jewish residents"
              value={facility.approx_jewish_resident_count?.toString()}
            />
            <InfoRow
              label="Active residents on file"
              value={facility.active_resident_count.toString()}
            />
            <InfoRow
              label="Recommended visit frequency"
              value={facility.recommended_visit_frequency}
            />
            <InfoRow
              label="Kosher food availability"
              value={
                facility.kosher_food_availability
                  ? labelFor(KOSHER_FOOD_OPTIONS, facility.kosher_food_availability)
                  : undefined
              }
            />
            <InfoRow
              label="Last visit"
              value={formatDateTime(facility.last_visit_at) ?? "No visits logged yet"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Residents ({residents.length})</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/residents/new?facility=${facility.id}`}>
              <Plus className="size-4" />
              Add resident
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {residents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No residents on file yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {residents.map((resident) => (
                <li key={resident.id}>
                  <Link
                    href={`/residents/${resident.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>
                      {resident.preferred_name ?? resident.first_name} {resident.last_name}
                      {resident.room_number ? ` · Room ${resident.room_number}` : ""}
                    </span>
                    <Badge variant="secondary">{labelFor(RESIDENT_STATUSES, resident.status)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent interactions</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionList interactions={interactions} variant="facility" />
        </CardContent>
      </Card>

      {facility.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {facility.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function formatAddress(facility: { address: string | null; city: string | null; zip: string | null }) {
  const parts = [facility.address, [facility.city, facility.zip].filter(Boolean).join(" ")].filter(
    Boolean
  );
  return parts.length ? parts.join(", ") : undefined;
}
