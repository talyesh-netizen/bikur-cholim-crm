import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFacility } from "@/lib/queries/facilities";
import { setFacilityActive } from "@/lib/actions/facilities";
import {
  labelFor,
  FACILITY_TYPES,
  ENGAGEMENT_STATUSES,
  VISIT_PRIORITIES,
  KOSHER_FOOD_OPTIONS,
} from "@/lib/domain/facility";
import { Pencil } from "lucide-react";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const facility = await getFacility(id);

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
            <InfoRow label="Last visit" value={formatLastVisit(facility.last_visit_at)} />
          </CardContent>
        </Card>
      </div>

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

function formatLastVisit(lastVisitAt: string | null) {
  if (!lastVisitAt) return "No visits logged yet";
  return new Date(lastVisitAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
