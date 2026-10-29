import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StoryForm } from "@/components/story-form";
import { saveStory } from "@/lib/actions/stories";
import { listFacilities } from "@/lib/queries/facilities";
import { getStory } from "@/lib/queries/stories";
import { residentOptions } from "@/lib/resident-options";
import { safeReturnTo } from "@/lib/return-to";
import { formatDateOnly } from "@/lib/format-date";

export default async function EditStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const story = await getStory(id);
  if (!story) notFound();
  const [residents, active] = await Promise.all([residentOptions(story.resident_id), listFacilities()]);
  // Its facility stays offered even if it's no longer active, so saving
  // a text change never drops the link.
  const facilities =
    story.facility_id && !active.some((f) => f.id === story.facility_id)
      ? [...active, { id: story.facility_id, name: story.facility_name ?? "Facility" }]
      : active;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit story</h1>
        <p className="text-sm text-muted-foreground">
          Written {formatDateOnly(story.created_at)}
          {story.written_by ? ` by ${story.written_by}` : ""}.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <StoryForm
            action={saveStory.bind(null, id, safeReturnTo(back) ?? "/stories")}
            residents={residents}
            facilities={facilities}
            initial={{ story: story.story, resident_id: story.resident_id ?? "", facility_id: story.facility_id ?? "" }}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
