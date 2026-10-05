import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MissingNameBadge, ResidentActiveStatus } from "@/components/status-badge";
import { ClusterBadge } from "@/components/cluster-badge";
import { getResident, getResidentFacilityHistory } from "@/lib/queries/residents";
import { listInteractionsForResident, listVolunteersForResident } from "@/lib/queries/interactions";
import { VisitPartnersCard } from "@/components/visit-partners-card";
import { listResidentContacts } from "@/lib/queries/contacts";
import { listTasks } from "@/lib/queries/tasks";
import { setResidentContactActive, setPrimaryResidentContact } from "@/lib/actions/resident-contacts";
import { labelFor as labelForContact, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import { telHref } from "@/lib/link-helpers";
import { InteractionList } from "@/app/(app)/interactions/interaction-list";
import { TaskList } from "@/app/(app)/tasks/task-list";
import { InfoRow } from "@/components/info-row";
import { ProfileNotesCard } from "@/components/profile-notes-card";
import { Fold } from "@/components/fold";
import { listResidentProfileNotes } from "@/lib/queries/profile-notes";
import { Pencil, ArrowRightLeft, Plus, UserX, Undo2, Star, HeartHandshake } from "lucide-react";
import { residentName } from "@/lib/domain/resident-name";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { listChangesForRecord } from "@/lib/queries/change-log";
import { ChangeHistoryList } from "@/components/change-history-list";

function residenceUnitLabel(facilityType: string | null) {
  return facilityType === "assisted_living" || facilityType === "independent_living" || facilityType === "senior_apartment" ? "Apt" : "Room";
}

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [resident, history, interactions, volunteers, familyContacts, tasks, profileNotes, profile, changes] = await Promise.all([
    getResident(id),
    getResidentFacilityHistory(id),
    listInteractionsForResident(id),
    listVolunteersForResident(id),
    listResidentContacts(id),
    listTasks({ residentId: id, showAllStatuses: true }),
    listResidentProfileNotes(id),
    getCurrentProfile(),
    listChangesForRecord("residents", id),
  ]);

  if (!resident) notFound();

  const displayName = residentName(resident);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          {!resident.first_name || !resident.last_name ? (
            <Link href={`/residents/${resident.id}/edit`} className="mt-1 inline-block hover:opacity-80">
              <MissingNameBadge resident={resident} />
            </Link>
          ) : null}
          <p className="mt-1 flex items-center gap-1.5">
            {resident.current_facility_id ? (
              <Link href={`/facilities/${resident.current_facility_id}`} className="hover:opacity-80">
                <ClusterBadge clusterId={resident.current_facility_cluster_id} name={resident.current_facility_name ?? "Unknown facility"} />
              </Link>
            ) : (
              <ClusterBadge clusterId={null} name="Current location unknown" />
            )}
            {resident.room_number ? (
              <span className="text-sm text-muted-foreground">{residenceUnitLabel(resident.current_facility_type)} {resident.room_number}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/interactions/new?resident=${resident.id}`}>
              <Plus className="size-4" />
              Log an interaction
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/interactions/new?resident=${resident.id}&type=family_communication`}>
              <HeartHandshake className="size-4" />
              Family support
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResidentActiveStatus status={resident.status} />
        <div className="flex gap-4 text-sm">
          <Link href={`/residents/${resident.id}/edit`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Pencil className="size-4" />
            Edit
          </Link>
          <Link href={`/residents/${resident.id}/transfer`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowRightLeft className="size-4" />
            Move
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <dt className="text-xs text-muted-foreground">Last visit</dt>
          <dd className="mt-1 truncate text-sm font-semibold sm:text-base">{formatDateTime(resident.last_visit_at) ?? "None yet"}</dd>
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <dt className="text-xs text-muted-foreground">Next follow-up</dt>
          <dd className="mt-1 truncate text-sm font-semibold sm:text-base">{formatDateOnly(resident.next_follow_up_date) ?? "None"}</dd>
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <dt className="text-xs text-muted-foreground">Phone</dt>
          <dd className="mt-1 truncate text-sm font-semibold sm:text-base">
            {resident.phone_number ? (
              <a href={telHref(resident.phone_number)} className="hover:underline">
                {resident.phone_number}
              </a>
            ) : (
              "Not recorded"
            )}
          </dd>
        </div>
      </dl>

      <Fold title="Recent interactions" count={interactions.length} open>
        <InteractionList interactions={interactions} variant="resident" />
      </Fold>

      <Fold
        title="Family"
        count={familyContacts.filter((rc) => rc.active).length}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href={`/residents/${resident.id}/contacts/new`}>
              <Plus className="size-4" />
              Add family contact
            </Link>
          </Button>
        }
      >
          {familyContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No family contacts on file yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {familyContacts.map((rc) => {
                const deactivate = setResidentContactActive.bind(null, resident.id, rc.id, false);
                const reactivate = setResidentContactActive.bind(null, resident.id, rc.id, true);
                const makePrimary = setPrimaryResidentContact.bind(null, resident.id, rc.id);
                return (
                  <li
                    key={rc.id}
                    className={`relative -mx-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 flex items-start justify-between gap-4 text-sm ${rc.active ? "" : "opacity-60"}`}
                  >
                    <div>
                      <Link href={`/contacts/${rc.contact.id}`} className="stretched-link font-medium hover:underline">
                        {rc.contact.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {rc.relationship_to_resident === "other" && rc.relationship_other_description
                          ? rc.relationship_other_description
                          : labelForContact(RESIDENT_CONTACT_RELATIONSHIPS, rc.relationship_to_resident)}
                        {rc.contact.phone ? (
                          <>
                            {" · "}
                            <a href={telHref(rc.contact.phone)} className="relative z-10 hover:underline">
                              {rc.contact.phone}
                            </a>
                          </>
                        ) : (
                          ""
                        )}
                      </p>
                    </div>
                    <div className="relative z-10 flex items-center gap-1">
                      {!rc.active ? (
                        <Badge variant="outline">Inactive</Badge>
                      ) : rc.is_primary_contact ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <form action={makePrimary}>
                          <Button size="sm" variant="ghost" type="submit" title="Make primary contact">
                            <Star className="size-4" />
                          </Button>
                        </form>
                      )}
                      <Button size="sm" variant="ghost" asChild title="Edit relationship">
                        <Link href={`/residents/${resident.id}/contacts/${rc.id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      {rc.active ? (
                        <form action={deactivate}>
                          <Button size="sm" variant="ghost" type="submit" title="Deactivate">
                            <UserX className="size-4" />
                          </Button>
                        </form>
                      ) : (
                        <form action={reactivate}>
                          <Button size="sm" variant="ghost" type="submit" title="Reactivate">
                            <Undo2 className="size-4" />
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </Fold>

      <Fold
        title="Follow-up tasks"
        count={tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href={`/tasks/new?resident=${resident.id}`}>
              <Plus className="size-4" />
              Add task
            </Link>
          </Button>
        }
      >
        <TaskList tasks={tasks} />
      </Fold>

      <Fold title="About">
        <div className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
          <InfoRow label="Sex" value={resident.sex ? resident.sex.charAt(0).toUpperCase() + resident.sex.slice(1) : null} />
          <InfoRow label="Preferred visit frequency" value={resident.preferred_visit_frequency} />
          <InfoRow label="Visitation needs" value={resident.visitation_needs} />
          <InfoRow label="How we found them" value={resident.referral_source} />
          <InfoRow label="Rabbi / synagogue" value={resident.rabbi_synagogue_connection} />
          <InfoRow label="Interests / background" value={resident.jewish_interests_background} />
          <InfoRow label="Kosher food needs" value={resident.kosher_food_needs} />
          <InfoRow label="Holiday support needs" value={resident.holiday_support_needs} />
        </div>
      </Fold>

      <Fold title="Notes" count={profileNotes.length}>
        <ProfileNotesCard targetType="resident" targetId={resident.id} notes={profileNotes} compact />
      </Fold>


      <Fold title="Facility history" count={history.length}>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No facility history recorded.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.map((entry) => (
                <li key={entry.id} className="relative -mx-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 flex items-start justify-between gap-4 text-sm">
                  <div>
                    <Link href={`/facilities/${entry.facility_id}`} className="stretched-link font-medium hover:underline">
                      {entry.facility_name}
                    </Link>
                    {entry.reason ? (
                      <p className="text-xs text-muted-foreground">{entry.reason}</p>
                    ) : null}
                  </div>
                  <p className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateOnly(entry.start_date)} –{" "}
                    {entry.end_date ? formatDateOnly(entry.end_date) : "present"}
                  </p>
                </li>
              ))}
            </ol>
          )}
      </Fold>

      <Fold title="Volunteers who visit" count={volunteers.length}>
        <VisitPartnersCard
          title="Volunteers who visit"
          partners={volunteers}
          hrefBase="/contacts"
          emptyMessage="No volunteer visits logged yet."
          bare
        />
      </Fold>

      {resident.private_internal_notes ? (
        <Fold title="Private internal notes">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{resident.private_internal_notes}</p>
        </Fold>
      ) : null}

      {profile?.role === "admin" ? (
        <Fold title="Change history" count={changes.length}>
          <p className="text-sm text-muted-foreground">Every edit to this resident: who, when, and what it said before. Only administrators see this.</p>
          <ChangeHistoryList entries={changes} />
        </Fold>
      ) : null}
    </div>
  );
}

