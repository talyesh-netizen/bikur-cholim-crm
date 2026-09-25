import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClusterBadge } from "@/components/cluster-badge";
import { ResidentStatusBadge, StatusBadge } from "@/components/status-badge";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { KeyFact, KeyFacts } from "@/components/key-facts";
import { getResident, getResidentFacilityHistory } from "@/lib/queries/residents";
import { listInteractionsForResident } from "@/lib/queries/interactions";
import { listResidentContacts } from "@/lib/queries/contacts";
import { listTasks } from "@/lib/queries/tasks";
import { setResidentContactActive, setPrimaryResidentContact } from "@/lib/actions/resident-contacts";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import { labelFor as labelForContact, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { formatDateOnly, formatRelative, getLocalToday } from "@/lib/format-date";
import { telHref } from "@/lib/link-helpers";
import { InteractionList } from "@/app/(app)/interactions/interaction-list";
import { TaskList } from "@/app/(app)/tasks/task-list";
import { InfoRow } from "@/components/info-row";
import {
  Pencil,
  ArrowRightLeft,
  UserX,
  Undo2,
  Star,
  HeartHandshake,
  MessageSquarePlus,
  ListPlus,
  Phone,
  ListChecks,
  History,
  Users,
  Sparkles,
  BookOpen,
  Building2,
  Lock,
} from "lucide-react";

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [resident, history, interactions, familyContacts, tasks] = await Promise.all([
    getResident(id),
    getResidentFacilityHistory(id),
    listInteractionsForResident(id),
    listResidentContacts(id),
    listTasks({ residentId: id, showAllStatuses: true }),
  ]);

  if (!resident) notFound();

  const displayName = resident.preferred_name
    ? `${resident.preferred_name} ${resident.last_name}`
    : `${resident.first_name} ${resident.last_name}`;
  const fullNameNote =
    resident.preferred_name && resident.preferred_name !== resident.first_name
      ? `${resident.first_name} ${resident.last_name}`
      : null;

  const lastInteraction = interactions[0]?.occurred_at ?? null;
  const openTasks = tasks.filter((t) => (OPEN_TASK_STATUSES as readonly string[]).includes(t.status));
  const today = getLocalToday();
  const followUpOverdue = !!resident.next_follow_up_date && resident.next_follow_up_date < today;

  const needs = [
    { label: "Visitation needs", value: resident.visitation_needs },
    { label: "Kosher food", value: resident.kosher_food_needs },
    { label: "Holiday support", value: resident.holiday_support_needs },
    { label: "Preferred visit frequency", value: resident.preferred_visit_frequency },
  ].filter((n) => n.value && n.value.trim());

  const activeFamily = familyContacts.filter((rc) => rc.active);

  return (
    <div className="flex flex-col gap-5">
      {/* At a glance */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{displayName}</h1>
              <ResidentStatusBadge status={resident.status} />
            </div>
            {fullNameNote ? <p className="-mt-1 text-sm text-muted-foreground">{fullNameNote}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-base">
              <Link href={`/facilities/${resident.current_facility_id}`} className="hover:underline">
                <ClusterBadge
                  clusterId={resident.current_facility_cluster_id}
                  name={resident.current_facility_name ?? "Unknown facility"}
                  className="text-sm"
                />
              </Link>
              <span className="text-muted-foreground">
                {resident.room_number ? `Room ${resident.room_number}` : "Room not recorded"}
              </span>
              {telHref(resident.phone_number) ? (
                <a
                  href={telHref(resident.phone_number)}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Phone className="size-4" />
                  {resident.phone_number}
                </a>
              ) : null}
            </div>
          </div>

          <KeyFacts>
            <KeyFact label="Last interaction" value={formatRelative(lastInteraction) ?? "None yet"} />
            <KeyFact
              label="Next follow-up"
              value={formatDateOnly(resident.next_follow_up_date) ?? "None scheduled"}
              emphasis={followUpOverdue ? "urgent" : undefined}
            />
            <KeyFact
              label="Open tasks"
              value={openTasks.length === 0 ? "None" : openTasks.length}
              emphasis={openTasks.length > 0 ? "attention" : undefined}
            />
          </KeyFacts>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild size="lg" className="col-span-2 sm:col-span-1">
              <Link href={`/interactions/new?resident=${resident.id}&type=resident_visit`}>
                <HeartHandshake />
                Log a visit
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/interactions/new?resident=${resident.id}`}>
                <MessageSquarePlus />
                Other interaction
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/tasks/new?resident=${resident.id}`}>
                <ListPlus />
                Add task
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
            <Link
              href={`/residents/${resident.id}/edit`}
              className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
              Edit details
            </Link>
            <Link
              href={`/residents/${resident.id}/transfer`}
              className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowRightLeft className="size-4" />
              Move to another facility
            </Link>
          </div>
        </CardContent>
      </Card>

      <SectionCard title="Current needs" icon={Sparkles}>
        {needs.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No needs recorded yet"
            description="Kosher food, holiday support, and visiting preferences help whoever visits next. Add them when you learn them."
            action={{ href: `/residents/${resident.id}/edit`, label: "Add needs" }}
          />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {needs.map((need) => (
              <div key={need.label} className="rounded-lg border border-border px-3 py-2.5">
                <dt className="text-sm font-medium text-muted-foreground">{need.label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed">{need.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SectionCard>

      <SectionCard
        title="Follow-ups"
        icon={ListChecks}
        count={openTasks.length}
        action={{ href: `/tasks/new?resident=${resident.id}`, label: "Add" }}
      >
        <TaskList tasks={tasks} emptyAction={{ href: `/tasks/new?resident=${resident.id}`, label: "Add a follow-up task" }} />
      </SectionCard>

      <SectionCard
        title="Recent history"
        icon={History}
        action={{ href: `/interactions/new?resident=${resident.id}&type=resident_visit`, label: "Log visit" }}
      >
        <InteractionList
          interactions={interactions}
          variant="resident"
          emptyAction={{ href: `/interactions/new?resident=${resident.id}&type=resident_visit`, label: "Log the first visit" }}
        />
      </SectionCard>

      <SectionCard
        title="Family contacts"
        icon={Users}
        count={activeFamily.length}
        action={{ href: `/residents/${resident.id}/contacts/new`, label: "Add" }}
      >
        {familyContacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No family contacts added"
            description="Add a child, spouse, or other relative so staff know who to update after visits."
            action={{ href: `/residents/${resident.id}/contacts/new`, label: "Add a family contact" }}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {familyContacts.map((rc) => {
              const deactivate = setResidentContactActive.bind(null, resident.id, rc.id, false);
              const reactivate = setResidentContactActive.bind(null, resident.id, rc.id, true);
              const makePrimary = setPrimaryResidentContact.bind(null, resident.id, rc.id);
              return (
                <li
                  key={rc.id}
                  className={`flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 ${rc.active ? "" : "opacity-60"}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/contacts/${rc.contact.id}`} className="font-medium hover:underline">
                        {rc.contact.name}
                      </Link>
                      {!rc.active ? (
                        <StatusBadge tone="muted">Inactive</StatusBadge>
                      ) : rc.is_primary_contact ? (
                        <StatusBadge tone="brand">Primary</StatusBadge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rc.relationship_to_resident === "other" && rc.relationship_other_description
                        ? rc.relationship_other_description
                        : labelForContact(RESIDENT_CONTACT_RELATIONSHIPS, rc.relationship_to_resident)}
                      {rc.contact.phone ? (
                        <>
                          {" · "}
                          <a href={telHref(rc.contact.phone)} className="text-foreground hover:underline">
                            {rc.contact.phone}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {rc.active && !rc.is_primary_contact ? (
                      <form action={makePrimary}>
                        <Button size="icon" variant="ghost" type="submit" title="Make primary contact" aria-label="Make primary contact">
                          <Star />
                        </Button>
                      </form>
                    ) : null}
                    <Button size="icon" variant="ghost" asChild title="Edit relationship">
                      <Link href={`/residents/${resident.id}/contacts/${rc.id}/edit`} aria-label="Edit relationship">
                        <Pencil />
                      </Link>
                    </Button>
                    {rc.active ? (
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
      </SectionCard>

      <SectionCard title="Background" icon={BookOpen}>
        <div className="flex flex-col gap-2.5">
          <InfoRow label="Rabbi / synagogue" value={resident.rabbi_synagogue_connection} />
          <InfoRow label="Interests / background" value={resident.jewish_interests_background} />
          <InfoRow label="How we found them" value={resident.referral_source} />
          <InfoRow label="Last visit" value={formatRelative(resident.last_visit_at) ?? "No visits logged yet"} />
        </div>
      </SectionCard>

      <SectionCard title="Facility history" icon={Building2}>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No moves recorded. If this resident changes facilities, use &ldquo;Move to another facility&rdquo; above so
            their history is kept.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
                <div>
                  <p className="font-medium">{entry.facility_name}</p>
                  {entry.reason ? <p className="text-sm text-muted-foreground">{entry.reason}</p> : null}
                </div>
                <p className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateOnly(entry.start_date)} – {entry.end_date ? formatDateOnly(entry.end_date) : "present"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      {resident.private_internal_notes ? (
        <SectionCard title="Private internal notes" icon={Lock}>
          <p className="whitespace-pre-wrap leading-relaxed">{resident.private_internal_notes}</p>
          <p className="mt-2 text-sm text-muted-foreground">Staff only — never shared with facilities or family.</p>
        </SectionCard>
      ) : null}
    </div>
  );
}
