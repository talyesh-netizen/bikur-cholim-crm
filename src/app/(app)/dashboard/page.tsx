import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import {
  getImpactBreakdown,
  getStaffActivity,
  getVolunteerImpact,
  getInteractionTrend,
  getServicesDelivered,
  type ImpactPeriod,
} from "@/lib/queries/impact";
import { createClient } from "@/lib/supabase/server";
import { TaskCard } from "../tasks/task-card";
import { DonutChart } from "@/components/donut-chart";
import { ImpactLeaderboard } from "@/components/impact-leaderboard";
import { TrendChart } from "@/components/trend-chart";
import { ServicesDeliveredTiles } from "@/components/services-delivered";
import { EmptyState } from "@/components/empty-state";
import { EngagementBadge, PriorityBadge } from "@/components/status-badge";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import { formatRelative, formatDateOnly } from "@/lib/format-date";
import {
  HeartHandshake,
  TrendingUp,
  ListPlus,
  Users,
  Building2,
  AlertCircle,
  UserRoundX,
  Activity,
  CheckCircle2,
  PieChart,
  Download,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORGANIZATION_TIMEZONE } from "@/lib/config";

const IMPACT_PERIODS: { value: ImpactPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "all", label: "All time" },
];

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

/** One number in the compact "Program at a glance" row. */
function Metric({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <p className="text-2xl font-semibold leading-none tabular-nums">{value.toLocaleString("en-US")}</p>
      <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg px-3 py-3 transition-colors hover:bg-accent/60">
      {body}
    </Link>
  ) : (
    <div className="px-3 py-3">{body}</div>
  );
}

/** A dashboard section. The "calm" state (nothing to do) is a quiet
 * single line rather than a big empty box, so the page's visual weight
 * always lands on whatever actually needs attention. */
function Section({
  title,
  icon: Icon,
  count,
  tone = "neutral",
  calmMessage,
  footer,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  tone?: "urgent" | "attention" | "neutral";
  calmMessage: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(count > 0 && tone === "urgent" && "border-l-4 border-l-destructive", count > 0 && tone === "attention" && "border-l-4 border-l-warning")}>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3 sm:pb-4">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <CardTitle className="text-base">{title}</CardTitle>
        {count > 0 ? (
          <span className="ml-auto text-sm font-medium tabular-nums text-muted-foreground">{count}</span>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {count === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            {calmMessage}
          </p>
        ) : (
          children
        )}
        {footer}
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
  const [{ data: { user } }, summary, impact, staffActivity, volunteerImpact, trend, services] = await Promise.all([
    supabase.auth.getUser(),
    getDashboardSummary(),
    getImpactBreakdown(impactPeriod),
    getStaffActivity(impactPeriod),
    getVolunteerImpact(impactPeriod),
    getInteractionTrend(6),
    getServicesDelivered(impactPeriod),
  ]);

  let firstName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    firstName = profile?.full_name?.split(" ")[0] ?? "";
  }

  const attentionCount = summary.overdueTasks.length + summary.dueTodayTasks.length;
  const attentionTasks = [...summary.overdueTasks, ...summary.dueTodayTasks].slice(0, 6);
  const interactionsThisMonth = trend[trend.length - 1]?.count ?? 0;
  const periodLabel = IMPACT_PERIODS.find((p) => p.value === impactPeriod)?.label ?? "";
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: ORGANIZATION_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const summaryLine =
    attentionCount === 0 && summary.staleResidents.length === 0 && summary.facilitiesNeedingAttention.length === 0
      ? "You're all caught up."
      : [
          attentionCount > 0 ? `${attentionCount} task${attentionCount === 1 ? "" : "s"} due` : null,
          summary.staleResidents.length > 0
            ? `${summary.staleResidents.length}${summary.staleResidents.length >= 10 ? "+" : ""} resident${summary.staleResidents.length === 1 ? "" : "s"} to visit`
            : null,
          summary.facilitiesNeedingAttention.length > 0
            ? `${summary.facilitiesNeedingAttention.length} facilit${summary.facilitiesNeedingAttention.length === 1 ? "y" : "ies"} to check on`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="text-2xl font-semibold">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">{summaryLine}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild>
            <Link href="/interactions/new?type=resident_visit">
              <HeartHandshake />
              Log a visit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tasks/new">
              <ListPlus />
              Add task
            </Link>
          </Button>
        </div>
      </div>

      <Section
        title="Needs attention today"
        icon={AlertCircle}
        count={attentionCount}
        tone={summary.overdueTasks.length > 0 ? "urgent" : "attention"}
        calmMessage="No overdue or due-today tasks — you're caught up."
        footer={
          <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">
            {summary.counts.openTasks > 0 ? `See all ${summary.counts.openTasks} open tasks` : "Go to tasks"} &rarr;
          </Link>
        }
      >
        <div className="flex flex-col gap-2.5">
          {attentionTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-2">
        <Section
          title="Residents not visited in 30+ days"
          icon={UserRoundX}
          count={summary.staleResidents.length}
          tone="attention"
          calmMessage="Every active resident has had a visit in the last 30 days."
        >
          <ul className="-mx-2 flex flex-col">
            {summary.staleResidents.map((resident) => (
              <li key={resident.id}>
                <Link
                  href={`/residents/${resident.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/60"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">
                      {resident.preferred_name ?? resident.first_name} {resident.last_name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {resident.current_facility_name ?? "No facility"}
                      {resident.room_number ? ` · Room ${resident.room_number}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-sm text-muted-foreground">
                    {resident.last_visit_at ? formatRelative(resident.last_visit_at) : "Never visited"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Facilities to check on"
          icon={Building2}
          count={summary.facilitiesNeedingAttention.length}
          tone="attention"
          calmMessage="No facilities are flagged for follow-up, and every high-priority facility was visited in the last 2 weeks."
        >
          <ul className="-mx-2 flex flex-col">
            {summary.facilitiesNeedingAttention.map((facility) => (
              <li key={facility.id}>
                <Link
                  href={`/facilities/${facility.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/60"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{facility.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {facility.last_visit_at ? `Last visit ${formatRelative(facility.last_visit_at)}` : "No visit logged yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {facility.engagement_status === "follow_up_needed" ? (
                      <EngagementBadge status={facility.engagement_status} />
                    ) : facility.visit_priority === "high" ? (
                      <PriorityBadge priority="high" />
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3 sm:pb-4">
          <Activity className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Link href="/interactions" className="ml-auto text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </CardHeader>
        <CardContent>
          {summary.recentActivity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nothing logged yet"
              description="Visits, calls, and programs will appear here as the team logs them."
              action={{ href: "/interactions/new?type=resident_visit", label: "Log a visit" }}
            />
          ) : (
            <ul className="-mx-2 flex flex-col">
              {summary.recentActivity.map((interaction) => (
                <li key={interaction.id}>
                  <Link
                    href={`/interactions/${interaction.id}`}
                    className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-accent/60"
                  >
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-tone-brand-bg text-xs font-semibold text-tone-brand-fg">
                      {(interaction.staff_member_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="font-medium leading-snug">
                          {labelFor(INTERACTION_TYPES, interaction.interaction_type)}
                          {interaction.interaction_type === "volunteer_visit"
                            ? ` · ${interaction.volunteers.map((v) => v.name).join(", ") || "no volunteer tagged"}`
                            : interaction.resident_name
                              ? ` · ${interaction.resident_name}`
                              : ""}
                        </p>
                        <span className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateOnly(interaction.occurred_at.slice(0, 10))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {interaction.facility_name ? `${interaction.facility_name} · ` : ""}
                        {interaction.staff_member_name ?? "Unknown"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Program at a glance</h2>
        <Card>
          <CardContent className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-4 sm:p-2">
            <Metric label="Interactions this month" value={interactionsThisMonth} href="/interactions" />
            <Metric label="Open tasks" value={summary.counts.openTasks} href="/tasks" />
            <Metric label="Active residents" value={summary.counts.activeResidents} href="/residents" />
            <Metric label="Active facilities" value={summary.counts.activeFacilities} href="/facilities" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2">
              <PieChart className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Impact</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-md bg-muted p-1" role="tablist" aria-label="Time period">
                {IMPACT_PERIODS.map((p) => (
                  <Link
                    key={p.value}
                    href={p.value === "month" ? "/dashboard" : `/dashboard?impact=${p.value}`}
                    scroll={false}
                    role="tab"
                    aria-selected={impactPeriod === p.value}
                    className={cn(
                      "rounded px-2.5 py-1.5 text-sm font-medium transition-colors md:text-xs",
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
            <DonutChart segments={impact.buckets} title={`Interactions by type — ${periodLabel}`} />
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
              <div>
                <h3 className="text-sm font-semibold">Services delivered — {periodLabel.toLowerCase()}</h3>
                <p className="text-sm text-muted-foreground">
                  Beyond visits and facility programs. Included in the export.
                  {services.staffHours > 0 ? ` ${services.staffHours.toLocaleString("en-US")} staff hours logged.` : ""}
                  {services.funderStories > 0 ? ` ${services.funderStories} entries flagged as funder stories.` : ""}
                </p>
              </div>
              <ServicesDeliveredTiles services={services} />
            </div>
          </CardContent>
        </Card>

        <details className="group rounded-xl border border-border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-base font-semibold sm:px-6">
            <TrendingUp className="size-4 text-muted-foreground" />
            Trends, staff &amp; volunteer activity
            <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-6 border-t border-border p-4 sm:p-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Activity over time</h3>
              <TrendChart data={trend} title="Interactions logged per month, last 6 months" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-muted-foreground" />
                  Staff activity — {periodLabel.toLowerCase()}
                </h3>
                <ImpactLeaderboard rows={staffActivity} barColor="#2a78d6" emptyMessage="No interactions logged in this period yet." />
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <HeartHandshake className="size-4 text-muted-foreground" />
                  Volunteer visits — {periodLabel.toLowerCase()}
                </h3>
                <ImpactLeaderboard rows={volunteerImpact} barColor="#1baf7a" emptyMessage="No volunteer visits logged in this period yet." />
              </div>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
