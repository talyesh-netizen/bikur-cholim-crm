import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ClipboardCheck, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFacility } from "@/lib/queries/facilities";
import { listResidents } from "@/lib/queries/residents";
import { listTasksForFacility } from "@/lib/queries/tasks";
import { SectionIcon } from "@/components/section-icon";
import { StatusBadge } from "@/components/status-badge";
import { sectionVars, type Section } from "@/lib/sections";
import { ProfileNotesCard } from "@/components/profile-notes-card";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import { formatDateOnly, formatRelative, getLocalToday } from "@/lib/format-date";
import { residentName } from "@/lib/domain/resident-name";

import { VisitChecklist } from "./visit-checklist";
import { logOnsiteVisits } from "@/lib/actions/onsite";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** One of the three counts at the top, striped in its section's color
 * like the dashboard tiles. */
function CountTile({ value, label, section }: { value: number; label: string; section: Section }) {
  return (
    <Card className="border-t-4" style={{ borderTopColor: sectionVars(section).accent }}>
      <CardContent className="p-3 text-center sm:p-3">
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function needsVisit(lastVisitAt: string | null) {
  if (!lastVisitAt) return true;
  return Date.now() - new Date(lastVisitAt).getTime() >= THIRTY_DAYS_MS;
}

export default async function FacilityOnsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [facility, residents] = await Promise.all([
    getFacility(id),
    listResidents({ facilityId: id, showAllStatuses: true }),
  ]);

  if (!facility) notFound();

  const tasks = await listTasksForFacility(
    id,
    residents.map((resident) => resident.id)
  );

  const currentResidents = residents
    .filter((resident) => ACTIVE_RESIDENT_STATUSES.includes(resident.status))
    .sort((a, b) => {
      const aNeeds = needsVisit(a.last_visit_at) ? 0 : 1;
      const bNeeds = needsVisit(b.last_visit_at) ? 0 : 1;
      if (aNeeds !== bNeeds) return aNeeds - bNeeds;
      return (a.room_number ?? "ZZZ").localeCompare(b.room_number ?? "ZZZ", undefined, { numeric: true });
    });

  const today = getLocalToday();
  const urgentTasks = tasks.filter((task) => task.due_date && task.due_date <= today);
  const residentsNeedingVisit = currentResidents.filter((resident) => needsVisit(resident.last_visit_at));
  const residentsMissingRoom = currentResidents.filter((resident) => !resident.room_number);

  const tasksByResident = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.resident_id) continue;
    const existing = tasksByResident.get(task.resident_id) ?? [];
    existing.push(task);
    tasksByResident.set(task.resident_id, existing);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/facilities/${facility.id}`}>
            <ArrowLeft />
            Facility
          </Link>
        </Button>
        <Badge variant="secondary">Onsite mode</Badge>
      </div>

      <div>
        <div className="flex items-start gap-2">
          <SectionIcon section="facilities" icon={Building2} className="mt-0.5" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{facility.name}</h1>
            <p className="text-sm text-muted-foreground">
              {facility.city ?? "City not recorded"} · {currentResidents.length} current resident{currentResidents.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <ProfileNotesCard targetType="facility" targetId={facility.id} notes={[]} compact />

      <div className="grid grid-cols-3 gap-2">
        <CountTile value={residentsNeedingVisit.length} label="Need a visit" section="residents" />
        <CountTile value={tasks.length} label="Open follow ups" section="tasks" />
        <CountTile value={residentsMissingRoom.length} label="Rooms to confirm" section="facilities" />
      </div>

      {(urgentTasks.length > 0 || residentsMissingRoom.length > 0) ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4" />
              Confirm while you are here
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {urgentTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="font-medium">{task.title}</span>
                  {task.resident_name ? (
                    <span className="block text-xs text-muted-foreground">{task.resident_name}</span>
                  ) : null}
                </span>
                {task.due_date === today ? (
                  <StatusBadge tone="attention">Due today</StatusBadge>
                ) : (
                  <StatusBadge tone="urgent">Overdue</StatusBadge>
                )}
              </Link>
            ))}
            {residentsMissingRoom.map((resident) => (
              <Link
                key={resident.id}
                href={`/residents/${resident.id}`}
                className="rounded-md border px-3 py-2 hover:bg-accent"
              >
                Confirm room for <span className="font-medium">{residentName(resident)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {currentResidents.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Who did you see today?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tick everyone you visited, then save once. Each gets their own visit, logged now.
            </p>
          </CardHeader>
          <CardContent>
            <VisitChecklist
              action={logOnsiteVisits.bind(null, facility.id)}
              residents={currentResidents.map((resident) => ({
                id: resident.id,
                name: residentName(resident),
                detail: [
                  resident.room_number ? `Room ${resident.room_number}` : null,
                  `Last visit: ${formatRelative(resident.last_visit_at) ?? "none yet"}`,
                ]
                  .filter(Boolean)
                  .join(" · "),
                needsVisit: needsVisit(resident.last_visit_at),
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Right after saving visits: the other two things that happen on
          a visit. Each comes back to this screen when saved. */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" asChild>
          <Link href={`/interactions/new?facility=${facility.id}&type=family_communication&from=onsite`}>
            Talked with family
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/interactions/new?facility=${facility.id}&type=facility_staff_communication&from=onsite`}>
            Talked with staff
          </Link>
        </Button>
      </div>

      {/* Visits are ticked off above; this is only for what comes after --
          a follow-up task or a lasting note -- so room and last visit
          aren't repeated here. */}
      {currentResidents.length > 0 ? (
        // Folded shut so the screen stays short; anything due is already
        // flagged above under "Confirm while you are here".
        <Fold title="Follow-ups & notes" count={currentResidents.length} open={currentResidents.length <= 5}>
          <p className="-mt-1 text-sm text-muted-foreground">Anything to do later, or worth remembering about someone.</p>
          <ul className="-mx-4 divide-y border-t">
            {currentResidents.map((resident) => {
              const residentTasks = tasksByResident.get(resident.id) ?? [];
              return (
                <li key={resident.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/residents/${resident.id}`} className="font-medium leading-snug hover:underline">
                        {residentName(resident)}
                      </Link>
                      {residentTasks.length > 0 || resident.next_follow_up_date ? (
                        <p className="text-xs text-muted-foreground">
                          {residentTasks.length > 0
                            ? `${residentTasks.length} open follow-up${residentTasks.length === 1 ? "" : "s"}`
                            : null}
                          {resident.next_follow_up_date
                            ? `${residentTasks.length > 0 ? " · " : ""}next ${formatDateOnly(resident.next_follow_up_date)}`
                            : null}
                        </p>
                      ) : null}
                    </div>
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                      <Link href={`/tasks/new?facility=${facility.id}&resident=${resident.id}&from=onsite`}>
                        <ListChecks />
                        Follow up
                      </Link>
                    </Button>
                  </div>
                  <ProfileNotesCard targetType="resident" targetId={resident.id} notes={[]} compact />
                </li>
              );
            })}
          </ul>
        </Fold>
      ) : (
        <p className="text-sm text-muted-foreground">No current residents are on file for this facility.</p>
      )}
    </div>
  );
}
