import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { TaskCard } from "../tasks/task-card";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import { ENGAGEMENT_STATUSES } from "@/lib/domain/facility";
import { formatDateTime, formatDateOnly } from "@/lib/format-date";

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="p-4">
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionCard({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  const attentionTasks = [...summary.overdueTasks, ...summary.dueTodayTasks].slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A quick summary of what needs attention today.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Open tasks" value={summary.counts.openTasks} href="/tasks" />
        <StatCard label="Active residents" value={summary.counts.activeResidents} href="/residents" />
        <StatCard label="Active facilities" value={summary.counts.activeFacilities} href="/facilities" />
      </div>

      <SectionCard
        title="Needs attention today"
        count={attentionTasks.length}
        emptyMessage="No overdue or due-today tasks — you're caught up."
      >
        <div className="flex flex-col gap-3">
          {attentionTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        {summary.overdueTasks.length + summary.dueTodayTasks.length > attentionTasks.length ? (
          <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">
            View all tasks →
          </Link>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Residents without a recent visit"
        count={summary.staleResidents.length}
        emptyMessage="Everyone active has had a visit logged in the last 30 days."
      >
        <div className="flex flex-col divide-y divide-border">
          {summary.staleResidents.map((resident) => (
            <Link
              key={resident.id}
              href={`/residents/${resident.id}`}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-primary"
            >
              <div>
                <p className="font-medium leading-tight">
                  {resident.preferred_name ?? resident.first_name} {resident.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resident.current_facility_name ?? "No facility"}
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {resident.last_visit_at ? `Last visit ${formatDateTime(resident.last_visit_at)}` : "No visit logged yet"}
              </span>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Facilities needing attention"
        count={summary.facilitiesNeedingAttention.length}
        emptyMessage="No facilities currently flagged as needing attention."
      >
        <div className="flex flex-col divide-y divide-border">
          {summary.facilitiesNeedingAttention.map((facility) => (
            <Link
              key={facility.id}
              href={`/facilities/${facility.id}`}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-primary"
            >
              <div>
                <p className="font-medium leading-tight">{facility.name}</p>
                <p className="text-xs text-muted-foreground">
                  {facility.last_visit_at ? `Last visit ${formatDateTime(facility.last_visit_at)}` : "No visit logged yet"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {facility.visit_priority === "high" ? <Badge variant="destructive">High priority</Badge> : null}
                {facility.engagement_status === "follow_up_needed" ? (
                  <Badge variant="warning">{labelFor(ENGAGEMENT_STATUSES, facility.engagement_status)}</Badge>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Recent activity"
        count={summary.recentActivity.length}
        emptyMessage="No activity logged yet."
      >
        <div className="flex flex-col divide-y divide-border">
          {summary.recentActivity.map((interaction) => (
            <div key={interaction.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium leading-tight">
                  {labelFor(INTERACTION_TYPES, interaction.interaction_type)}
                  {interaction.resident_name ? ` · ${interaction.resident_name}` : ""}
                  {interaction.facility_name ? ` · ${interaction.facility_name}` : ""}
                </p>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateOnly(interaction.occurred_at.slice(0, 10))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Logged by {interaction.staff_member_name ?? "Unknown"}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
