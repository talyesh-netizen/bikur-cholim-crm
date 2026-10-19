import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { getFacility, listFacilities } from "@/lib/queries/facilities";
import { residentOptions } from "@/lib/resident-options";
import { safeReturnTo } from "@/lib/return-to";
import { listContactOptions, listResidentContacts } from "@/lib/queries/contacts";
import { labelFor as labelForContact, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { createInteraction } from "@/lib/actions/interactions";
import { InteractionForm } from "../interaction-form";
import { INTERACTION_TYPES, labelFor } from "@/lib/domain/interaction";
import { residentName } from "@/lib/domain/resident-name";
import { onsiteHref } from "@/lib/onsite-links";
import { getActivityFormOptions } from "@/lib/queries/activity";

export default async function NewInteractionPage({
  searchParams,
}: {
  searchParams: Promise<{ resident?: string; facility?: string; type?: string; from?: string; contact?: string; back?: string }>;
}) {
  const { resident: residentId, facility: facilityId, type, from, contact: contactId, back } = await searchParams;
  const defaultType = INTERACTION_TYPES.some((t) => t.value === type) ? type : undefined;

  const [facilities, resident, residents, allContacts, volunteers, residentFamily, activity] = await Promise.all([
    listFacilities(),
    residentId ? getResident(residentId) : Promise.resolve(null),
    residentOptions(residentId),
    listContactOptions(),
    listContactOptions("volunteer"),
    residentId ? listResidentContacts(residentId) : Promise.resolve([]),
    getActivityFormOptions(),
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
  // Tapped a staff member or family member on site: they're already
  // chosen (only ever someone already in the list).
  const chosenContact = contactId ? contacts.find((c) => c.id === contactId) : undefined;

  if (residentId && !resident) notFound();
  if (facilityId) {
    const facility = await getFacility(facilityId);
    if (!facility) notFound();
  }

  // Opened from on-site mode: go back there, not to the facility page.
  // Back to the tab it was started from: staff to Staff, anything
  // about a resident to that resident, still open.
  const onsiteReturn =
    from === "onsite"
      ? onsiteHref(
          facilityId,
          defaultType === "facility_staff_communication" ? "staff" : "residents",
          defaultType === "family_communication" ? residentId : undefined
        )
      : undefined;
  // Back to the page the person started from (e.g. the facility page
  // they opened this resident from), else the resident or facility.
  const redirectTo = onsiteReturn
    ? onsiteReturn
    : safeReturnTo(back)
    ? safeReturnTo(back)!
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
  // "Note" on the onsite directory opens this as type "other".
  const heading = chosenContact ? `Log: talked with ${chosenContact.name}` : isVisit ? "Log a visit" : defaultType === "other" ? "Add a note" : defaultType ? `Log: ${labelFor(INTERACTION_TYPES, defaultType)}` : "Log an interaction";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fixedResident
            ? `For ${fixedResident.name}. The date is today; change it for an earlier visit.`
            : "Record a visit, call, or other activity. The date is today; change it for an earlier visit."}
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
            defaultContactId={chosenContact?.id}
            fixedResident={fixedResident}
            residents={residents}
            contacts={contacts}
            volunteers={volunteers}
            activity={activity}
            submitLabel={isVisit ? "Save visit" : "Save interaction"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
