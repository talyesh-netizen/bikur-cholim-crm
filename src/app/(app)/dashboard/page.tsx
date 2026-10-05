import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { listFacilities } from "@/lib/queries/facilities";
import { createClient } from "@/lib/supabase/server";
import { TaskCard } from "../tasks/task-card";
import { DashboardOnsiteLauncher } from "@/components/dashboard-onsite-launcher";
import { Sparkles, BellRing, ChartColumn, HeartHandshake } from "lucide-react";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import { ENGAGEMENT_STATUSES } from "@/lib/domain/facility";
import { formatRelative, formatDateTime, orgMonthStart, orgDayStartIso } from "@/lib/format-date";
import {
  ListChecks,
  Users,
  Building2,
  AlertCircle,
  UserRoundX,
  Activity,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORGANIZATION_TIMEZONE } from "@/lib/config";
import { SectionIcon } from "@/components/section-icon";
import { sectionVars, type Section } from "@/lib/sections";
import { residentName } from "@/lib/domain/resident-name";

/** The server (Vercel) runs in UTC, not Cleveland time, so reading the
 * hour/date directly off `new Date()` here could show "Good evening" at
 * 9am or the wrong weekday -- read both in the org's own timezone instead. */
function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { timeZone: ORGANIZATION_TIMEZONE, hour: "numeric", hour12: false })
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  href,
  icon,
  section,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  section: Section;
}) {
  return (
    <Link href={href}>
      {/* A stripe across the top in the section's color -- the same
          color that section's icon wears in the menu. */}
      <Card
        className="border-t-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
        style={{ borderTopColor: sectionVars(section).accent }}
      >
        <CardContent className="flex items-center gap-3 p-4 sm:p-4">
          <SectionIcon section={section} icon={icon} size="lg" />
          <div>
            <p className="text-2xl font-semibold leading-none">{value}</p>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const ACCENT_BORDERS = {
  destructive: "border-l-4 border-l-destructive",
  warning: "border-l-4 border-l-warning",
  neutral: "",
} as const;

function SectionCard({
  title,
  icon: Icon,
  count,
  accent = "neutral",
  emptyMessage,
  emptyIcon: EmptyIcon = CheckCircle2,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  accent?: keyof typeof ACCENT_BORDERS;
  emptyMessage: string;
  emptyIcon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(count > 0 ? ACCENT_BORDERS[accent] : "", "transition-shadow hover:shadow-md", className)}>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Icon className="size-4 text-muted-foreground" />
        <CardTitle className="text-base uppercase tracking-wide">{title}</CardTitle>
        {count > 0 ? (
          <Badge variant="secondary" className="ml-auto">
            {count}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {count === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
            <EmptyIcon className="size-4 shrink-0" />
            <span>{emptyMessage}</span>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { year: monthYear, month: monthNumber } = orgMonthStart();
  const monthStartIso = orgDayStartIso(`${monthYear}-${String(monthNumber).padStart(2, "0")}-01`)!;
  const [{ data: { user } }, summary, facilities, { data: familyRows }] = await Promise.all([
    supabase.auth.getUser(),
    getDashboardSummary(),
    listFacilities(),
    supabase
      .from("interactions")
      .select("contact_id, resident_id")
      .in("interaction_type", ["family_communication", "care_navigation"])
      .gte("occurred_at", monthStartIso),
  ]);
  // A family = the family member spoken with, else the resident whose family it was.
  const familiesThisMonth = new Set((familyRows ?? []).map((r) => r.contact_id ?? r.resident_id).filter(Boolean)).size;

  let firstName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    firstName = profile?.full_name?.split(" ")[0] ?? "";
  }

  const attentionTasks = [...summary.overdueTasks, ...summary.dueTodayTasks].slice(0, 6);
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: ORGANIZATION_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{today} &mdash; here&apos;s what needs attention.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <Link href="/quick-log">
            <Sparkles className="size-4" />
            Quick Log
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/needs-attention">
            <BellRing className="size-4" />
            Needs attention
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/impact">
            <ChartColumn className="size-4" />
            Our impact
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tasks" value={summary.counts.openTasks} href="/tasks" icon={ListChecks} section="tasks" />
        <StatCard label="Active residents" value={summary.counts.activeResidents} href="/residents" icon={Users} section="residents" />
        <StatCard label="Active facilities" value={summary.counts.activeFacilities} href="/facilities" icon={Building2} section="facilities" />
        <StatCard label="Families supported this month" value={familiesThisMonth} href="/impact?period=month" icon={HeartHandshake} section="contacts" />
      </div>

      <DashboardOnsiteLauncher
        facilities={facilities.map((facility) => ({
          id: facility.id,
          name: facility.name,
          address: facility.address,
          city: facility.city,
          zip: facility.zip,
        }))}
      />

      <SectionCard
        title="Needs attention today"
        icon={AlertCircle}
        count={summary.overdueTasks.length + summary.dueTodayTasks.length}
        accent={summary.overdueTasks.length > 0 ? "destructive" : "warning"}
        emptyMessage="No overdue or due-today tasks — you're caught up."
      >
        <div className="flex flex-col gap-3">
          {attentionTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        {summary.overdueTasks.length + summary.dueTodayTasks.length > attentionTasks.length ? (
          <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">
            View all tasks &rarr;
          </Link>
        ) : null}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Residents without a recent visit"
          icon={UserRoundX}
          count={summary.staleResidents.length}
          accent="warning"
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
                    {residentName(resident)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resident.current_facility_name ?? "Current location unknown"}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {resident.last_visit_at ? `Last visit ${formatRelative(resident.last_visit_at)}` : "No visit logged yet"}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Facilities needing attention"
          icon={Building2}
          count={summary.facilitiesNeedingAttention.length}
          accent="warning"
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
                    {facility.last_visit_at ? `Last visit ${formatRelative(facility.last_visit_at)}` : "No visit logged yet"}
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
      </div>

      <SectionCard
        title="Recent activity"
        icon={Activity}
        count={summary.recentActivity.length}
        emptyMessage="No activity logged yet."
        emptyIcon={Activity}
      >
        <div className="flex flex-col divide-y divide-border">
          {summary.recentActivity.map((interaction) => (
            <Link
              key={interaction.id}
              href={`/interactions/${interaction.id}`}
              className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/60"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(interaction.staff_member_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm font-medium leading-tight">
                    {labelFor(INTERACTION_TYPES, interaction.interaction_type)}
                    {interaction.interaction_type === "volunteer_visit"
                      ? ` · ${interaction.volunteers.map((v) => v.name).join(", ") || "not tagged yet"}`
                      : interaction.resident_name
                        ? ` · ${interaction.resident_name}`
                        : ""}
                    {interaction.facility_name ? ` · ${interaction.facility_name}` : ""}
                  </p>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(interaction.occurred_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Logged by {interaction.staff_member_name ?? "Unknown"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
