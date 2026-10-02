import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getResident, getResidentFacilityHistory } from "@/lib/queries/residents";
import { listFacilities } from "@/lib/queries/facilities";
import { transferResident } from "@/lib/actions/transfer-resident";
import { TransferForm } from "./transfer-form";
import { ArrowLeft } from "lucide-react";

export default async function TransferResidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [resident, facilities, history] = await Promise.all([
    getResident(id),
    listFacilities(),
    getResidentFacilityHistory(id),
  ]);

  if (!resident) notFound();

  const otherFacilities = facilities.filter((f) => f.id !== resident.current_facility_id);

  // The stay right before this one -- e.g. a short-term rehab move --
  // lets us offer "move back to X" as a one-click option instead of
  // making staff hunt for (and remember) the right facility, which is
  // how a resident's current facility ends up stale after a stay like
  // that ends. Only offered if that facility is still active/available.
  // When the current location is unknown there is no open stay, so the
  // most recent (already closed) stay is history[0].
  const previousHistoryEntry = resident.current_facility_id ? history[1] : history[0];
  const previousFacility = previousHistoryEntry
    ? otherFacilities.find((f) => f.id === previousHistoryEntry.facility_id)
    : undefined;

  const action = transferResident.bind(null, resident.id);
  const displayName = resident.preferred_name
    ? `${resident.preferred_name} ${resident.last_name}`
    : `${resident.first_name} ${resident.last_name}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/residents/${resident.id}`}>
            <ArrowLeft className="size-4" />
            Back to profile
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Move {displayName} to another facility</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Move details</CardTitle>
        </CardHeader>
        <CardContent>
          {otherFacilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no other active facilities to move this resident to
              yet. Add another facility first.
            </p>
          ) : (
            <TransferForm
              action={action}
              facilities={otherFacilities}
              currentFacilityName={
                resident.current_facility_id
                  ? resident.current_facility_name ?? "their current facility"
                  : null
              }
              previousFacility={previousFacility ? { id: previousFacility.id, name: previousFacility.name } : null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
