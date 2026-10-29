import { Card, CardContent } from "@/components/ui/card";
import { StoryForm } from "@/components/story-form";
import { saveStory } from "@/lib/actions/stories";
import { listFacilities } from "@/lib/queries/facilities";
import { residentOptions } from "@/lib/resident-options";
import { safeReturnTo } from "@/lib/return-to";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ resident?: string; facility?: string; back?: string }>;
}) {
  const { resident, facility, back } = await searchParams;
  const [residents, facilities] = await Promise.all([residentOptions(resident), listFacilities()]);
  // Started from a resident's or facility's page: already linked (only
  // ever one this person can see).
  const residentId = residents.some((r) => r.id === resident) ? resident! : "";
  const facilityId = facilities.some((f) => f.id === facility) ? facility! : "";
  const redirectTo = safeReturnTo(back) ?? (residentId ? `/residents/${residentId}` : facilityId ? `/facilities/${facilityId}` : "/stories");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New story</h1>
      <Card>
        <CardContent className="pt-6">
          <StoryForm
            action={saveStory.bind(null, null, redirectTo)}
            residents={residents}
            facilities={facilities}
            initial={residentId || facilityId ? { story: "", resident_id: residentId, facility_id: facilityId } : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
