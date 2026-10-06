import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { getFacility, listFacilities } from "@/lib/queries/facilities";
import { listResidents } from "@/lib/queries/residents";
import { listContactOptions, listResidentContacts } from "@/lib/queries/contacts";
import { labelFor as labelForContact, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { createInteraction } from "@/lib/actions/interactions";
import { InteractionForm } from "../interaction-form";
import { INTERACTION_TYPES, labelFor } from "@/lib/domain/interaction";
import { residentName } from "@/lib/domain/resident-name";

export default async function NewInteractionPage({
  searchParams,
}: {
  searchParams: Promise<{ resident?: string; facility?: string; type?: string; from?: string }>;
}) {
  const { resident: residentId, facility: facilityId, type, from } = await searchParams;
  const defaultType = INTERACTION_TYPES.some((t) => t.value === type) ? type : undefined;

  const [facilities, resident, residentsAtFacility, allContacts, volunteers, residentFamily] = await Promise.all([
    listFacilities(),
    residentId ? getResident(residentId) : Promise.resolve(null),
    !residentId && facilityId
      ? listResidents({ facilityId, showAllStatuses: true })
      : Promise.resolve([]),
    listContactOptions(),
    listContactOptions("volunteer"),
    residentId ? listResidentContacts(residentId) : Promise.resolve([]),
  ]);

  // The resident's own family members first ("Sarah Katz (daughter)"),
  // so logging family support is one pick, not a search.
  const family = residentFamily
    .filter((rc) => rc.active && rc.contact)
    .map((rc) => ({
      id: rc.contact_id,
      name: `${rc.contact.name} (${
        rc.relationship_to_resident === "other"
          ? rc.relationship_other_description || "family"
          : labelForContact(RESIDENT_CONTACT_RELATIONSHIPS, rc.relationship_to_resident).toLowerCase()
      })`,
    }));
  const familyIds = new Set(family.map((f) => f.id));
  const contacts = [...family, ...allContacts.filter((c) => !familyIds.has(c.id))];

  if (residentId && !resident) notFound();
  if (facilityId) {
    const facility = await getFacility(facilityId);
    if (!facility) notFound();
  }

  // Opened from on-site mode: go back there, not to the facility page.
  const redirectTo = from === "onsite" && facilityId
    ? `/facilities/${facilityId}/onsite`
    : residentId
    ? `/residents/${residentId}`
    : facilityId
      ? `/facilities/${facilityId}`
      : "/dashboard";
  const action = createInteraction.bind(null, redirectTo);

  const fixedResident = resident
    ? {
        id: resident.id,
        name: residentName(resident),
      }
    : undefined;

  const isVisit = defaultType === "resident_visit";
  const heading = isVisit ? "Log a visit" : defaultType ? `Log: ${labelFor(INTERACTION_TYPES, defaultType)}` : "Log an interaction";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fixedResident
            ? `For ${fixedResident.name}. Date and time are filled in for right now.`
            : "Record a visit, call, or other activity. Date and time are filled in for right now."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionForm
            action={action}
            facilities={facilities}
            defaultFacilityId={facilityId ?? resident?.current_facility_id ?? undefined}
            defaultInteractionType={defaultType}
            fixedResident={fixedResident}
            residents={residentsAtFacility.map((r) => ({
              id: r.id,
              name: residentName(r),
            }))}
            contacts={contacts}
            volunteers={volunteers}
            submitLabel={isVisit ? "Save visit" : "Save interaction"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
