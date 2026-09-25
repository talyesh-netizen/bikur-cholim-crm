import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFacility } from "@/lib/queries/facilities";
import { setFacilityActive } from "@/lib/actions/facilities";
import { listResidents } from "@/lib/queries/residents";
import { listInteractionsForFacility } from "@/lib/queries/interactions";
import { listFacilityContacts } from "@/lib/queries/contacts";
import { listTasks } from "@/lib/queries/tasks";
import { setFacilityContactActive, setPrimaryFacilityContact } from "@/lib/actions/facility-contacts";
import { labelFor, FACILITY_TYPES, KOSHER_FOOD_OPTIONS } from "@/lib/domain/facility";
import { ACTIVE_RESIDENT_STATUSES, type ResidentWithSummary } from "@/lib/domain/resident";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import { ClusterBadge } from "@/components/cluster-badge";
import { EngagementBadge, PriorityBadge, ResidentStatusBadge, StatusBadge } from "@/components/status-badge";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { KeyFact, KeyFacts } from "@/components/key-facts";
import { labelFor as labelForContact, CONTACT_TYPES } from "@/lib/domain/contact";
import { formatRelative } from "@/lib/format-date";
import { telHref, websiteHref, mapsHref } from "@/lib/link-helpers";
import { InteractionList } from "@/app/(app)/interactions/interaction-list";
import { TaskList } from "@/app/(app)/tasks/task-list";
import { InfoRow } from "@/components/info-row";
import {
  Pencil,
  Plus,
  UserX,
  Undo2,
  Star,
  Phone,
  MapPin,
  HeartHandshake,
  MessageSquarePlus,
  UserPlus,
  ListChecks,
  Users,
  Contact,
  History,
  Info,
  NotebookText,
  ChevronRight,
  Power,
} from "lucide-react";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [facility, residents, interactions, facilityContacts, tasks] = await Promise.all([
    getFacility(id),
    listResidents({ facilityId: id, showAllStatuses: true }),
    listInteractionsForFacility(id),
    listFacilityContacts(id),
    listTasks({ facilityId: id, showAllStatuses: true }),
  ]);

  if (!facility) notFound();

  const toggleActive = setFacilityActive.bind(null, facility.id, !facility.active);
  const mainContact = facilityContacts.find((fc) => fc.is_primary_contact && fc.active) ?? null;
  const openTasks = tasks.filter((t) => (OPEN_TASK_STATUSES as readonly string[]).includes(t.status));
  const isCurrent = (r: ResidentWithSummary) => (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status);
  const currentResidents = residents.filter(isCurrent);
  const pastResidents = residents.filter((r) => !isCurrent(r));
  const address = formatAddress(facility);
  const activeContacts = facilityContacts.filter((fc) => fc.active);

  return (
    <div className="flex flex-col gap-5">
      {/* At a glance */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{facility.name}</h1>
              {!facility.active ? <StatusBadge tone="muted">Inactive</StatusBadge> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span>{labelFor(FACILITY_TYPES, facility.facility_type)}</span>
              {facility.city ? (
                <a
                  href={mapsHref(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <MapPin className="size-4" />
                  {facility.city}
                </a>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <EngagementBadge status={facility.engagement_status} />
              {facility.visit_priority !== "low" ? <PriorityBadge priority={facility.visit_priority} /> : null}
              {facility.geographic_cluster_name ? (
                <ClusterBadge clusterId={facility.geographic_cluster_id} name={facility.geographic_cluster_name} />
              ) : null}
            </div>
          </div>

          <KeyFacts>
            <KeyFact label="Last visit" value={formatRelative(facility.last_visit_at) ?? "None yet"} />
            <KeyFact
              label="Residents known"
              value={
                facility.approx_jewish_resident_count && facility.approx_jewish_resident_count > currentResidents.length
                  ? `${currentResidents.length} on file · ~${facility.approx_jewish_resident_count}`
                  : currentResidents.length
              }
            />
            <KeyFact
              label="Open tasks"
              value={openTasks.length === 0 ? "None" : openTasks.length}
              emphasis={openTasks.length > 0 ? "attention" : undefined}
            />
          </KeyFacts>

          {mainContact ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Main contact</p>
                <Link href={`/contacts/${mainContact.contact.id}`} className="font-medium hover:underline">
                  {mainContact.contact.name}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {mainContact.role_at_facility || labelForContact(CONTACT_TYPES, mainContact.contact.contact_type)}
                </p>
              </div>
              {telHref(mainContact.contact.phone) ? (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <a href={telHref(mainContact.contact.phone)}>
                    <Phone />
                    Call
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild size="lg" className="col-span-2 sm:col-span-1">
              <Link href={`/interactions/new?facility=${facility.id}&type=resident_visit`}>
                <HeartHandshake />
                Log a visit
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/interactions/new?facility=${facility.id}`}>
                <MessageSquarePlus />
                Other interaction
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/residents/new?facility=${facility.id}`}>
                <UserPlus />
                Add resident
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
            <Link
              href={`/facilities/${facility.id}/edit`}
              className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
              Edit details
            </Link>
            <form action={toggleActive}>
              <button
                type="submit"
                className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
              >
                <Power className="size-4" />
                {facility.active ? "Mark inactive" : "Mark active"}
              </button>
            </form>
          </div>
        </CardContent>
      </Card>

      <SectionCard
        title="Follow-ups"
        icon={ListChecks}
        count={openTasks.length}
        action={{ href: `/tasks/new?facility=${facility.id}`, label: "Add" }}
      >
        <TaskList tasks={tasks} emptyAction={{ href: `/tasks/new?facility=${facility.id}`, label: "Add a follow-up task" }} />
      </SectionCard>

      <SectionCard
        title="Residents"
        icon={Users}
        count={currentResidents.length}
        action={{ href: `/residents/new?facility=${facility.id}`, label: "Add" }}
      >
        {residents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No residents on file yet"
            description={
              facility.jewish_residents_currently_known
                ? "This facility is marked as having Jewish residents. Add them here as you meet them."
                : "When you meet a Jewish resident here, add them so visits and needs can be tracked."
            }
            action={{ href: `/residents/new?facility=${facility.id}`, label: "Add a resident" }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {currentResidents.length > 0 ? (
              <ResidentRows residents={currentResidents} />
            ) : (
              <p className="text-sm text-muted-foreground">No current residents — only past residents are on file.</p>
            )}
            {pastResidents.length > 0 ? (
              <details className="group">
                <summary className="cursor-pointer list-none py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <span className="group-open:hidden">Show {pastResidents.length} past resident{pastResidents.length === 1 ? "" : "s"}</span>
                  <span className="hidden group-open:inline">Hide past residents</span>
                </summary>
                <div className="mt-1 opacity-80">
                  <ResidentRows residents={pastResidents} />
                </div>
              </details>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Staff contacts" icon={Contact} count={activeContacts.length}>
        <div className="flex flex-col gap-3">
          {facilityContacts.length === 0 ? (
            <EmptyState
              icon={Contact}
              title="No staff contacts yet"
              description="Add the activities director, social worker, or front desk so anyone visiting knows who to ask for."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {facilityContacts.map((fc) => {
                const deactivate = setFacilityContactActive.bind(null, facility.id, fc.id, false);
                const reactivate = setFacilityContactActive.bind(null, facility.id, fc.id, true);
                const makePrimary = setPrimaryFacilityContact.bind(null, facility.id, fc.id);
                return (
                  <li
                    key={fc.id}
                    className={`flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 ${fc.active ? "" : "opacity-60"}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/contacts/${fc.contact.id}`} className="font-medium hover:underline">
                          {fc.contact.name}
                        </Link>
                        {!fc.active ? (
                          <StatusBadge tone="muted">Inactive</StatusBadge>
                        ) : fc.is_primary_contact ? (
                          <StatusBadge tone="brand">Main contact</StatusBadge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {fc.role_at_facility || labelForContact(CONTACT_TYPES, fc.contact.contact_type)}
                        {fc.contact.phone ? (
                          <>
                            {" · "}
                            <a href={telHref(fc.contact.phone)} className="text-foreground hover:underline">
                              {fc.contact.phone}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      {fc.active && !fc.is_primary_contact ? (
                        <form action={makePrimary}>
                          <Button size="icon" variant="ghost" type="submit" title="Make main contact" aria-label="Make main contact">
                            <Star />
                          </Button>
                        </form>
                      ) : null}
                      {fc.active ? (
                        <form action={deactivate}>
                          <Button size="icon" variant="ghost" type="submit" title="Mark inactive" aria-label="Mark inactive">
                            <UserX />
                          </Button>
                        </form>
                      ) : (
                        <form action={reactivate}>
                          <Button size="icon" variant="ghost" type="submit" title="Reactivate" aria-label="Reactivate">
                            <Undo2 />
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/facilities/${facility.id}/contacts/new`}>
                <Plus />
                New contact
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/facilities/${facility.id}/contacts/link`}>
                <Plus />
                Link existing contact
              </Link>
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent interactions"
        icon={History}
        action={{ href: `/interactions/new?facility=${facility.id}&type=resident_visit`, label: "Log visit" }}
      >
        <InteractionList
          interactions={interactions}
          variant="facility"
          emptyAction={{ href: `/interactions/new?facility=${facility.id}`, label: "Log the first interaction" }}
        />
      </SectionCard>

      <SectionCard title="Facility details" icon={Info}>
        <div className="flex flex-col gap-2.5">
          <InfoRow label="Address" value={address} href={mapsHref(address)} />
          <InfoRow label="Main phone" value={facility.main_phone} href={telHref(facility.main_phone)} />
          <InfoRow label="Website" value={facility.website} href={websiteHref(facility.website)} />
          <InfoRow label="Healthcare group" value={facility.parent_healthcare_group} />
          <InfoRow label="Approx. Jewish residents" value={facility.approx_jewish_resident_count?.toString()} />
          <InfoRow label="Recommended visits" value={facility.recommended_visit_frequency} />
          <InfoRow
            label="Kosher food"
            value={
              facility.kosher_food_availability
                ? labelFor(KOSHER_FOOD_OPTIONS, facility.kosher_food_availability)
                : undefined
            }
          />
        </div>
      </SectionCard>

      {facility.notes ? (
        <SectionCard title="Notes" icon={NotebookText}>
          <p className="whitespace-pre-wrap leading-relaxed">{facility.notes}</p>
        </SectionCard>
      ) : null}
    </div>
  );
}

function ResidentRows({ residents }: { residents: ResidentWithSummary[] }) {
  return (
    <ul className="-mx-2 flex flex-col">
      {residents.map((resident) => (
        <li key={resident.id}>
          <Link
            href={`/residents/${resident.id}`}
            className="flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/60"
          >
            <div className="min-w-0">
              <p className="font-medium leading-snug">
                {resident.preferred_name ?? resident.first_name} {resident.last_name}
                {resident.room_number ? (
                  <span className="font-normal text-muted-foreground"> · Room {resident.room_number}</span>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {resident.last_visit_at ? `Last visit ${formatRelative(resident.last_visit_at)}` : "No visits yet"}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              {resident.status !== "active" ? <ResidentStatusBadge status={resident.status} /> : null}
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatAddress(facility: { address: string | null; city: string | null; zip: string | null }) {
  const parts = [facility.address, [facility.city, facility.zip].filter(Boolean).join(" ")].filter(
    Boolean
  );
  return parts.length ? parts.join(", ") : undefined;
}
