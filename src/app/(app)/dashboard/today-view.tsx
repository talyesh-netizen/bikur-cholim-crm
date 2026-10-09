import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCard } from "../tasks/task-card";
import { DashboardOnsiteLauncher } from "@/components/dashboard-onsite-launcher";
import { CheckCircle2, ChevronRight, UserRoundX } from "lucide-react";
import { labelFor, INTERACTION_TYPES, type InteractionWithNames } from "@/lib/domain/interaction";
import type { TaskWithNames } from "@/lib/domain/task";
import { formatTimeOfDay } from "@/lib/format-date";

/** What Today shows, given its data (kept apart from the fetching so it
 * can be previewed on its own). */
export function TodayView({
  heading,
  today,
  facilities,
  due,
  mine,
  staleResidentsTotal,
}: {
  heading: string;
  today: string;
  facilities: Parameters<typeof DashboardOnsiteLauncher>[0]["facilities"];
  due: TaskWithNames[];
  mine: InteractionWithNames[];
  staleResidentsTotal: number;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">
          {heading}
        </h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      <DashboardOnsiteLauncher
        facilities={facilities}
      />

      <Card>
        <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-3">
          <CardTitle className="text-lg">My follow-ups</CardTitle>
          <span className="text-sm text-muted-foreground">{due.length ? `${due.length} due` : ""}</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {due.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" /> Nothing due today. You&apos;re caught up.
            </p>
          ) : (
            due.slice(0, 8).map((task) => <TaskCard key={task.id} task={task} />)
          )}
          <Link href="/tasks" className="flex min-h-11 items-center text-sm font-medium text-primary">
            All follow-ups <ChevronRight className="size-4" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-3">
          <CardTitle className="text-lg">What I logged today</CardTitle>
          <span className="text-sm text-muted-foreground">{mine.length ? mine.length : ""}</span>
        </CardHeader>
        <CardContent>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet today. Tap + Log to add something.</p>
          ) : (
            <ul className="-my-1 flex flex-col divide-y divide-border">
              {mine.map((x) => (
                <li key={x.id}>
                  <Link href={`/interactions/${x.id}`} className="flex min-h-11 items-center gap-3 py-2">
                    <span className="w-16 shrink-0 text-sm text-muted-foreground">{formatTimeOfDay(x.occurred_at)}</span>
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">
                        {labelFor(INTERACTION_TYPES, x.interaction_type)}
                        {x.quantity ? ` (${x.quantity})` : ""}
                      </span>
                      {x.resident_name ?? x.contact_name ? ` · ${x.resident_name ?? x.contact_name}` : ""}
                      {x.facility_name ? <span className="text-muted-foreground"> · {x.facility_name}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {staleResidentsTotal > 0 ? (
        <Link
          href="/needs-attention"
          className="flex min-h-12 items-center gap-3 rounded-xl border bg-card px-4 text-sm"
        >
          <UserRoundX className="size-5 shrink-0 text-muted-foreground" />
          <span className="flex-1">
            <span className="font-medium">{staleResidentsTotal} residents</span> haven&apos;t had a visit in 30 days
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}
    </div>
  );
}
