import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDailySummary } from "@/lib/queries/daily-summary";
import type { DayRecord } from "@/lib/domain/daily-summary";
import { INTERACTION_TYPES, labelFor } from "@/lib/domain/interaction";
import { getLocalToday } from "@/lib/format-date";
import { formatDayHeading, formatOrgTime, isIsoDate, shiftIsoDate } from "@/lib/org-day";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Info } from "lucide-react";

function Stat({ label, value, detail, tone }: { label: string; value: number; detail?: string | null; tone?: "warning" }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border p-3",
        tone === "warning" && value > 0 ? "border-warning/40 bg-warning/5" : "border-border"
      )}
    >
      <p className="text-2xl font-semibold leading-none">{value.toLocaleString("en-US")}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function RecordList({ title, records }: { title: string; records: DayRecord[] }) {
  if (records.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="secondary">{records.length}</Badge>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {records.map((r) => (
            <li key={r.id} className="border-b border-border py-2 last:border-0">
              <Link href={r.href} className="text-sm font-medium hover:text-primary">
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** "What happened today?" -- a read-only roll-up of one day's CRM
 * records, in Eastern Time. Every number comes from the database at the
 * moment the page loads. */
export default async function DailySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = getLocalToday();
  const invalidDate = date !== undefined && !isIsoDate(date);
  const day = isIsoDate(date) ? date : today;
  const isToday = day === today;

  const { summary: s, newResidents, newFacilities, residentMoves, followUps, truncated } = await getDailySummary(day);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Daily Summary</h1>
          <p className="text-sm text-muted-foreground">
            {formatDayHeading(day)}
            {isToday ? " · Today" : ""} · Eastern Time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/daily-summary?date=${shiftIsoDate(day, -1)}`} aria-label="Previous day">
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/daily-summary?date=${shiftIsoDate(day, 1)}`} aria-label="Next day">
              Next
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          {!isToday ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/daily-summary">Today</Link>
            </Button>
          ) : null}
          <form action="/daily-summary" className="flex items-center gap-2">
            <label htmlFor="date" className="sr-only">
              Choose a date
            </label>
            <Input id="date" type="date" name="date" defaultValue={day} className="h-9 w-auto" />
            <Button type="submit" size="sm" variant="secondary">
              <CalendarDays className="size-4" />
              Go
            </Button>
          </form>
        </div>

        {invalidDate ? (
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4 shrink-0" />
            That date couldn&apos;t be read, so today is shown instead.
          </p>
        ) : null}
        {truncated ? (
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4 shrink-0" />
            This day has more than 1,000 records — the counts below only cover the first 1,000.
          </p>
        ) : null}
      </div>

      {s.totalEntries === 0 &&
      newResidents.length === 0 &&
      newFacilities.length === 0 &&
      residentMoves.length === 0 &&
      followUps.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nothing was recorded in the CRM for this day.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Residents visited" value={s.residentsVisited} detail={`${s.residentsReached} reached in all`} />
            <Stat label="Facilities with activity" value={s.facilitiesWithActivity} />
            <Stat label="Staff interactions" value={s.staffInteractions} />
            <Stat
              label="Volunteer visits"
              value={s.volunteerVisits}
              detail={s.volunteerVisitsUntagged > 0 ? `${s.volunteerVisitsUntagged} with no volunteer tagged` : null}
            />
            <Stat
              label="Food deliveries"
              value={s.foodDeliveries}
              detail={s.foodItemsDelivered > 0 ? `${s.foodItemsDelivered} meals/packages` : null}
            />
            <Stat
              label="Programs"
              value={s.programs}
              detail={s.programAttendance > 0 ? `${s.programAttendance} people reached` : null}
            />
            <Stat label="Follow-ups created" value={s.followUpsCreated} />
            <Stat label="New residents added" value={s.newResidents} />
            <Stat label="New facilities added" value={s.newFacilities} />
            <Stat label="Facility moves" value={s.residentMoves} />
            <Stat label="Funder stories flagged" value={s.funderStories} />
            <Stat label="Couldn't fully meet" value={s.unmetNeeds} tone="warning" />
          </div>

          {s.byType.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">All activity by type</CardTitle>
                <Badge variant="secondary">{s.totalEntries}</Badge>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col">
                  {s.byType.map((t) => (
                    <li key={t.type} className="flex justify-between border-b border-border py-2 text-sm last:border-0">
                      <span>{labelFor(INTERACTION_TYPES, t.type)}</span>
                      <span className="font-medium">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {s.byFacility.map((group) => (
            <Card key={group.facilityId ?? "none"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {group.facilityId ? (
                    <Link href={`/facilities/${group.facilityId}`} className="hover:text-primary">
                      {group.facilityName}
                    </Link>
                  ) : (
                    group.facilityName
                  )}
                </CardTitle>
                <Badge variant="secondary">{group.interactions.length}</Badge>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col">
                  {group.interactions.map((i) => (
                    <li key={i.id} className="border-b border-border py-2 last:border-0">
                      <Link href={`/interactions/${i.id}`} className="flex flex-col gap-1 text-sm hover:text-primary">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">{formatOrgTime(i.occurred_at)}</span>
                          <Badge variant="secondary">{labelFor(INTERACTION_TYPES, i.interaction_type)}</Badge>
                          {i.interaction_type === "volunteer_visit" && i.volunteer_count === 0 ? (
                            <Badge variant="warning">No volunteer tagged</Badge>
                          ) : null}
                          {i.funder_story ? <Badge variant="outline">Funder story</Badge> : null}
                        </div>
                        <span className="font-medium">{i.resident_name ?? "No resident linked"}</span>
                        {i.staff_member_name ? (
                          <span className="text-xs text-muted-foreground">Logged by {i.staff_member_name}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          <RecordList title="New residents added" records={newResidents} />
          <RecordList title="New facilities added" records={newFacilities} />
          <RecordList title="Facility moves" records={residentMoves} />
          <RecordList title="Follow-ups created" records={followUps} />
        </>
      )}

      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Counts come straight from CRM records for this Eastern Time day. &quot;Resident unavailable&quot; visits and room
        number changes aren&apos;t recorded separately yet, so they don&apos;t appear here.
      </p>
    </div>
  );
}
