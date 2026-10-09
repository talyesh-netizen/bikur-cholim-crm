import { QuickLog } from "./quick-log";
import { SectionIcon } from "@/components/section-icon";
import { Sparkles } from "lucide-react";
import { getFacility, listFacilities } from "@/lib/queries/facilities";
import { getResident } from "@/lib/queries/residents";
import { residentName } from "@/lib/domain/resident-name";

// Reading a note takes the assistant anywhere from a few seconds to
// a couple of minutes for a long one; give the server action room so
// it isn't cut off.
export const maxDuration = 300;

export default async function QuickLogPage({
  searchParams,
}: {
  searchParams: Promise<{ resident?: string; facility?: string }>;
}) {
  // "+ Log" on a resident's or facility's page opens this already set to
  // them, so there's nothing to pick first.
  const params = await searchParams;
  const [facilities, resident] = await Promise.all([
    listFacilities(),
    params.resident ? getResident(params.resident) : Promise.resolve(null),
  ]);
  const facilityId = params.facility ?? resident?.current_facility_id ?? null;
  const facility = facilityId ? await getFacility(facilityId) : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <SectionIcon section="log" icon={Sparkles} />
            Log
          </h1>
        <p className="text-sm text-muted-foreground">
          Talk or type what happened. It sorts out where each thing goes, and you check it before anything is saved.
        </p>
      </div>
      <QuickLog
        facilities={facilities.map((f) => ({ id: f.id, name: f.name, city: f.city }))}
        initialPlace={facility ? { kind: "facility", id: facility.id, name: facility.name } : resident ? { kind: "none" } : undefined}
        about={resident ? { residentId: resident.id, residentName: residentName(resident) } : undefined}
      />
    </div>
  );
}
