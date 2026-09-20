import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import {
  getImpactBreakdown,
  getStaffActivity,
  getVolunteerImpact,
  getInteractionTrend,
  type ImpactPeriod,
} from "@/lib/queries/impact";
import { createClient } from "@/lib/supabase/server";
import { TaskCard } from "../tasks/task-card";
import { DonutChart } from "@/components/donut-chart";
import { ImpactLeaderboard } from "@/components/impact-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { HeartHandshake, TrendingUp } from "lucide-react";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import { ENGAGEMENT_STATUSES } from "@/lib/domain/facility";
import { formatRelative, formatDateOnly } from "@/lib/format-date";
import {
  ListChecks,
  Users,
  Building2,
  AlertCircle,
  UserRoundX,
  Activity,
  CheckCircle2,
  PieChart,
  Download,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const IMPACT_PERIODS: { value: ImpactPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "all", label: "All time" },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const STAT_TONES = {
  warning: { bg: "bg-warning/10", text: "text-warning" },
  primary: { bg: "bg-primary/10", text: "text-primary" },
  success: { bg: "bg-success/10", text: "text-success" },
} as const;

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone: keyof typeof STAT_TONES;
}) {
  const { bg, text } = STAT_TONES[tone];
  return (
    <Link href={href}>
      <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", bg, text)}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
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
        <CardTitle className="text-base">{title}</CardTitle>
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const impactPeriod: ImpactPeriod =
    params.impact === "quarter" || params.impact === "all" ? params.impact : "month";

  const supabase = await createClient();
  const [{ data: { user } }, summary, impact, staffActivity, volunteerImpact, trend] = await Promise.all([
    supabase.auth.getUser(),
    getDashboardSummary(),
    getImpactBreakdown(impactPeriod),
    getStaffActivity(impactPeriod),
    getVolunteerImpact(impactPeriod),
    getInteractionTrend(6),
  ]);

  let firstName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    firstName = profile?.full_name?.split(" ")[0] ?? "";
  }

  const attentionTasks = [...summary.overdueTasks, ...summary.dueTodayTasks].slice(0, 6);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{today} &mdash; here&apos;s what needs attention.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Open tasks" value={summary.counts.openTasks} href="/tasks" icon={ListChecks} tone="warning" />
        <StatCard label="Active residents" value={summary.counts.activeResidents} href="/residents" icon={Users} tone="primary" />
        <StatCard label="Active facilities" value={summary.counts.activeFacilities} href="/facilities" icon={Building2} tone="success" />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Impact</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-md bg-muted p-1">
              {IMPACT_PERIODS.map((p) => (
                <Link
                  key={p.value}
                  href={p.value === "month" ? "/dashboard" : `/dashboard?impact=${p.value}`}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    impactPeriod === p.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/impact-report?period=${impactPeriod}`}>
                <Download className="size-4" />
                Export
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DonutChart segments={impact.buckets} title={`Interactions by type — ${IMPACT_PERIODS.find((p) => p.value === impactPeriod)?.label}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <TrendingUp className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Activity over time</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={trend} title="Interactions logged per month, last 6 months" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Users className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Staff impact</CardTitle>
          </CardHeader>
          <CardContent>
            <ImpactLeaderboard
              rows={staffActivity}
              barColor="#2a78d6"
              emptyMessage="No interactions logged in this period yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <HeartHandshake className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Volunteer impact</CardTitle>
          </CardHeader>
          <CardContent>
            <ImpactLeaderboard
              rows={volunteerImpact}
              barColor="#1baf7a"
              emptyMessage="No volunteer visits logged in this period yet."
            />
          </CardContent>
        </Card>
      </div>

      <SectionCard
        title="Needs attention today"
        icon={AlertCircle}
        count={attentionTasks.length}
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
                    {resident.preferred_name ?? resident.first_name} {resident.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resident.current_facility_name ?? "No facility"}
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
            <div key={interaction.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(interaction.staff_member_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
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
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
