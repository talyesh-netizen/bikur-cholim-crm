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
import { ProfileNotesCard } from "@/components/profile-notes-card";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import { formatDateOnly, formatRelative, getLocalToday } from "@/lib/format-date";
import { residentName } from "@/lib/domain/resident-name";

import { VisitChecklist } from "./visit-checklist";
import { logOnsiteVisits } from "@/lib/actions/onsite";
import { QuickLog } from "../../../quick-log/quick-log";
import { quickLogEnabled } from "@/lib/quick-log-enabled";
import { getCurrentProfile } from "@/lib/get-current-profile";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Reading a note takes the assistant anywhere from a few seconds to
// about a minute; give the server action room so it isn't cut off.
export const maxDuration = 120;

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

  const [facility, residents, profile] = await Promise.all([
    getFacility(id),
    listResidents({ facilityId: id, showAllStatuses: true }),
    getCurrentProfile(),
  ]);
  const notesOn = quickLogEnabled();

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

      {/* The main way to log a visit: write it all down once; the
          assistant works out the visits, new people, follow-ups and
          moves, and nothing is saved until it's checked. */}
      {notesOn ? (
        <QuickLog onSite={{ facilityId: facility.id, facilityName: facility.name }} />
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">The notes box isn&apos;t switched on yet.</p>
            <p className="mt-1">
              {profile?.role === "admin"
                ? "Add the ANTHROPIC_API_KEY setting in Vercel to write your whole visit in one note. Until then, tick off visits below."
                : "Ask an admin to switch it on. Until then, tick off visits below."}
            </p>
          </CardContent>
        </Card>
      )}

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

      {/* The older quick way: tick names, no notes. Kept as a backup,
          folded away when the notes box is on. */}
      <Fold title={notesOn ? "Or just tick off who you saw" : "Who did you see today?"} open={!notesOn}>
        {currentResidents.length > 0 ? (
          <>
            <p className="-mt-1 text-sm text-muted-foreground">
              Tick everyone you visited, then save once. Each gets their own visit, logged now.
            </p>
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
          </>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
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
      </Fold>

      {/* Visits are ticked off above; this is only for what comes after --
          a follow-up task or a lasting note -- so room and last visit
          aren't repeated here. */}
      {currentResidents.length > 0 ? (
        // Folded shut so the screen stays short; anything due is already
        // flagged above under "Confirm while you are here".
        <Fold title="Follow-ups & notes" count={currentResidents.length} open={false}>
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
