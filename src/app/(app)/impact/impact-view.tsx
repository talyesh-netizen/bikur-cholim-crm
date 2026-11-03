import Link from "next/link";
import { Button } from "@/components/ui/button";
import { METRIC_BY_KEY, SECTIONS, recordsHref, type ImpactPageData, type SectionKey } from "@/lib/queries/impact-metrics";
import type { ReportPeriod } from "@/lib/report-period";
import { PeriodPicker } from "@/components/period-picker";
import { ChartCard, HBars, HeadlineTile, Legend, MonthBars, PercentLine, SERIES, SplitBar } from "@/components/impact/charts";
import type { ImpactGrowth } from "@/lib/queries/impact-growth";
import { IMPACT_GOALS } from "@/lib/impact-goals";
import { formatDateOnly } from "@/lib/format-date";
import { Download } from "lucide-react";
import { InfoTip } from "@/components/info-tip";

const n = (v: number) => v.toLocaleString("en-US");

const SECTION_COLORS: Record<SectionKey, string> = {
  residents: SERIES.residents,
  coverage: "#4a3aa7",
  programs: SERIES.reached,
  school: "#008300",
  volunteers: SERIES.volunteers,
  food: "#eda100",
  family: SERIES.families,
  professional: "#c2410c",
};

/** Which numbers each section shows, in order (Q7, Nov 3, 2026). */
const SECTION_METRICS: Record<SectionKey, string[]> = {
  residents: ["residents_served", "resident_engagements", "staff_resident_visits", "phone_calls", "volunteer_resident_visits", "group_visits", "group_visit_reached", "referrals", "rides"],
  coverage: ["activity_days", "staff_confirmed_days", "not_recorded_days", "no_staff_days", "staff_visits_confirmed", "staff_visits_not_recorded", "facilities_with_activity", "facilities_with_staff", "facilities_engaged"],
  programs: ["programs", "program_residents", "not_split"],
  school: ["school_programs", "schools_involved", "students", "chaperones", "student_volunteers"],
  volunteers: ["volunteer_outings", "volunteers_active", "volunteer_residents", "volunteer_visits", "program_volunteers"],
  food: ["deliveries", "food_people", "food_not_recorded"],
  family: ["families", "family_conversations"],
  professional: ["staff_interactions", "staff_people", "staff_facilities", "partner_conversations", "partner_people", "appreciation", "appreciation_facilities"],
};

/** One number: its few words, the full definition behind the "i", and a
 * tap to the records behind it. */
function Stat({ metric, value, period, extra }: { metric: string; value: number; period: ReportPeriod; extra?: string | null }) {
  const def = METRIC_BY_KEY.get(metric)!;
  return (
    <div>
      <dt className="flex items-center gap-1 text-sm text-muted-foreground">
        {def.label}
        <InfoTip label={def.label}>{def.full}</InfoTip>
      </dt>
      <dd className="text-2xl font-bold tabular-nums">
        <Link href={recordsHref(metric, period)} className="underline-offset-4 hover:underline" title="See the records behind this number">
          {def.approx && value > 0 ? "~" : ""}
          {n(value)}
        </Link>
      </dd>
      <dd className="text-xs text-muted-foreground">{extra ?? def.short}</dd>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: SectionKey; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`sec-${id}`} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id={`sec-${id}`} className="flex items-center gap-2.5 text-lg font-bold">
          <span aria-hidden className="size-3 rounded-[3px]" style={{ backgroundColor: SECTION_COLORS[id] }} />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      {children}
    </section>
  );
}

export function ImpactView({
  period,
  choices,
  data,
  growth,
  fellBackToAllTime = false,
}: {
  period: ReportPeriod;
  choices: { quick: { key: string; label: string }[]; months: { key: string; label: string }[]; quarters: { key: string; label: string }[] };
  data: ImpactPageData;
  growth?: ImpactGrowth;
  fellBackToAllTime?: boolean;
}) {
  const p = period;
  const v = data.metrics.values;
  const prev = data.previous;
  const periodPhrase = period.from ? `in ${period.label}` : "so far";
  const famGoal = IMPACT_GOALS.familyConnection;
  const famTrend = (growth?.familyConnection ?? []).filter((f) => f.known > 0);

  // Extra words under a few numbers.
  const extras: Record<string, string | null> = {
    programs: `${n(v.programs_at_facility)} at facilities · ${n(v.programs_elsewhere)} elsewhere`,
    schools_involved: v.schools_not_named > 0 ? `+ ${n(v.schools_not_named)} program${v.schools_not_named === 1 ? "" : "s"} with no school named` : null,
    not_recorded_days: v.attendance_not_recorded_entries > 0 ? `${n(v.attendance_not_recorded_entries)} entries to confirm` : null,
    volunteer_outings:
      v.volunteer_outings_estimated > 0
        ? `incl. ${n(v.volunteer_outings_estimated)} estimated from older entries (grouped, not verified)`
        : null,
  };

  const sectionCharts: Partial<Record<SectionKey, React.ReactNode>> = {
    residents: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Visits & calls per month" subtitle={`With a named resident · ${period.from ? period.label : "last 6 months"}`}>
          <Legend items={[{ label: "Staff visits & calls", color: SERIES.residents }, { label: "Volunteer visits", color: SERIES.volunteers }]} />
          <MonthBars data={data.visitsByMonth} colors={[SERIES.residents, SERIES.volunteers]} names={["by staff", "by volunteers"]} />
        </ChartCard>
        <ChartCard title="Reached by holiday" subtitle={`Visits, programs and deliveries marked with a holiday · ${p.label.toLowerCase()}`}>
          {data.metrics.holidays.length > 0 ? (
            <HBars
              data={data.metrics.holidays.map((h) => ({ label: h.label, value: h.value, href: `/interactions?holiday=${h.key}${period.from ? `&from=${period.from}&to=${period.to}` : ""}` }))}
              color={SERIES.residents}
              labelWidth={110}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing marked with a holiday {periodPhrase}.</p>
          )}
        </ChartCard>
      </div>
    ),
    family: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Family conversations per month" subtitle={`Calls, visits and messages with family · ${period.from ? period.label : "last 6 months"}`}>
          <MonthBars data={data.familyByMonth} colors={[SERIES.families]} names={["conversations"]} />
        </ChartCard>
        <ChartCard title="What families needed" subtitle={`Where it was picked · ${p.label.toLowerCase()}`}>
          {data.metrics.familyNeeds.length > 0 ? (
            <HBars data={data.metrics.familyNeeds} color={SERIES.families} labelWidth={150} />
          ) : (
            <p className="text-sm text-muted-foreground">Not recorded {periodPhrase}.</p>
          )}
        </ChartCard>
      </div>
    ),
    professional: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Facility staff interactions per month" subtitle={`Each staff person spoken with, once per entry · ${period.from ? period.label : "last 6 months"}`}>
          <MonthBars data={data.staffByMonth} colors={[SECTION_COLORS.professional]} names={["staff interactions"]} />
        </ChartCard>
        <ChartCard title="Most-supported facility teams" subtitle={`Facility staff interactions · ${p.label.toLowerCase()} · tap for the records`}>
          {data.topFacilities.length > 0 ? (
            <HBars data={data.topFacilities} color={SECTION_COLORS.professional} labelWidth={150} />
          ) : (
            <p className="text-sm text-muted-foreground">No facility staff interactions {periodPhrase}.</p>
          )}
          {data.metrics.partnersByType.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Partners spoken with: {data.metrics.partnersByType.map((t) => `${t.label} ${n(t.value)}`).join(" · ")}
            </p>
          ) : null}
        </ChartCard>
      </div>
    ),
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Our impact</h1>
          <p className="text-muted-foreground">
            What we did and who we reached {periodPhrase}. Tap any number to see the records behind it.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <PeriodPicker basePath="/impact" currentKey={period.key} {...choices} />
          <Button asChild>
            <a href={`/api/impact-report?period=${encodeURIComponent(period.key)}${period.key.includes("..") ? `&from=${period.from}&to=${period.to}` : ""}`}>
              <Download className="size-4" />
              Export for funders
            </a>
          </Button>
          {/* The earlier export, unchanged, until the new one is verified
              (director, Nov 3, 2026). */}
          <a
            href={`/api/impact-report/previous?period=${encodeURIComponent(period.key)}${period.key.includes("..") ? `&from=${period.from}&to=${period.to}` : ""}`}
            className="self-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Previous format
          </a>
        </div>
      </header>

      {fellBackToAllTime ? (
        <p className="rounded-lg bg-tone-attention-bg px-3 py-2 text-sm text-tone-attention-fg">
          Nothing has been logged yet this quarter, so this shows all time.
        </p>
      ) : null}

      <section aria-label="Headline numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HeadlineTile
          color={SERIES.residents}
          label="Residents served one-on-one"
          href={recordsHref("residents_served", period)}
          value={n(v.residents_served)}
          detail={`different residents · ${n(v.staff_resident_visits)} staff visits, ${n(v.phone_calls)} calls, ${n(v.volunteer_resident_visits)} volunteer visits`}
          current={v.residents_served}
          previous={prev?.residents_served ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.families}
          label="Families supported"
          href={recordsHref("families", period)}
          value={n(v.families)}
          detail={`families · ${n(v.family_conversations)} conversations`}
          current={v.families}
          previous={prev?.families ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SECTION_COLORS.professional}
          label="Facility staff supported"
          href={recordsHref("staff_interactions", period)}
          value={n(v.staff_interactions)}
          detail={`interactions · ${n(v.staff_people)} staff · ${n(v.staff_facilities)} facilities`}
          current={v.staff_interactions}
          previous={prev?.staff_interactions ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SECTION_COLORS.coverage}
          label="Facility activity-days"
          href={recordsHref("activity_days", period)}
          value={n(v.activity_days)}
          detail={`${n(v.staff_confirmed_days)} staff confirmed · ${n(v.not_recorded_days)} not recorded · ${n(v.no_staff_days)} no staff`}
          current={v.activity_days}
          previous={prev?.activity_days ?? null}
          periodWord={p.word}
        />
      </section>

      {data.corrections ? (
        <section aria-label="Corrections" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="font-medium">
            {data.corrections.entries === 1
              ? "1 entry in this period was corrected (reviewed as a copy of another, or voided), so it no longer counts."
              : `${n(data.corrections.entries)} entries in this period were corrected (reviewed as copies of others, or voided), so they no longer count.`}
          </p>
          <p className="text-muted-foreground">
            As first recorded: {n(data.corrections.asFirstRecorded.residents_served)} residents served,{" "}
            {n(data.corrections.asFirstRecorded.family_conversations)} family conversations,{" "}
            {n(data.corrections.asFirstRecorded.staff_interactions)} staff interactions. Corrected (above): {n(v.residents_served)},{" "}
            {n(v.family_conversations)}, {n(v.staff_interactions)}.{" "}
            <Link
              href={`/interactions?corrected=1${period.from ? `&from=${period.from}&to=${period.to}` : ""}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              See the corrected entries
            </Link>
          </p>
        </section>
      ) : null}

      {SECTIONS.map((s) => (
        <Section key={s.key} id={s.key} title={s.title} intro={s.intro}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {SECTION_METRICS[s.key].map((key) => (
              <Stat key={key} metric={key} value={v[key] ?? 0} period={period} extra={extras[key]} />
            ))}
          </dl>
          {s.key === "coverage" ? (
            <p className="text-xs text-muted-foreground">
              Staff presence confirmed + attendance not recorded + no staff there = facility activity-days. Phone calls and entries with no
              facility never count here.
            </p>
          ) : null}
          {sectionCharts[s.key] ?? null}
        </Section>
      ))}

      {data.metrics.staff.length > 0 || data.metrics.volunteers.length > 0 ? (
        <section aria-labelledby="team" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="team" className="text-xl font-bold">Team</h2>
            <p className="text-sm text-muted-foreground">Who did the work {periodPhrase}. Tap a name to see their records.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Staff" subtitle="Staff visits are confirmed physical presence; coordinated only = arranged but wasn't there">
              <TeamTable
                head={["Staff visits", "Not recorded", "Activities", "Coordinated only"]}
                rows={data.metrics.staff.map((r) => ({
                  id: r.id,
                  name: r.name,
                  href: recordsHref(`staff:${r.id}`, period),
                  cells: [r.staffVisits, r.notRecorded, r.activities, r.coordinatedOnly],
                }))}
              />
            </ChartCard>
            <ChartCard title="Volunteers" subtitle="Outings: each actual outing once, however many residents it saw">
              <TeamTable
                head={["Outings", "Residents visited", "Visit entries"]}
                rows={data.metrics.volunteers.map((r) => ({
                  id: r.id,
                  name: r.name,
                  href: recordsHref(`volunteer:${r.id}`, period),
                  cells: [r.outings, r.residents, r.visits],
                }))}
                empty="No volunteer visits in this period."
              />
            </ChartCard>
          </div>
        </section>
      ) : null}

      {/* Today (Q7): these don't follow the period picked. */}
      <section aria-labelledby="today" className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-5">
        <div className="flex flex-col gap-1">
          <h2 id="today" className="text-xl font-bold">Today</h2>
          <p className="text-sm text-muted-foreground">These show where things stand now. They don&apos;t change with the period picked above.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Time since last in-person visit" subtitle={`${n(data.activeResidents)} active residents, today`}>
            <HBars data={data.recency} color={SERIES.residents} />
            {data.notVisited30 > 0 ? (
              <Link href="/needs-attention" className="rounded-lg bg-tone-attention-bg px-3 py-2 text-sm text-tone-attention-fg hover:underline">
                {n(data.notVisited30)} of {n(data.activeResidents)} haven&apos;t had an in-person visit in 30+ days
                {data.calledRecently > 0 ? ` (${n(data.calledRecently)} of them had a call in the last 30 days)` : ""} → Needs attention
              </Link>
            ) : null}
          </ChartCard>
          <ChartCard title="Family connections on file" subtitle="Active residents with at least one family contact">
            <div className="flex items-baseline gap-2.5">
              <span className="text-4xl font-bold tracking-tight tabular-nums">
                {data.activeResidents > 0 ? Math.round((data.withFamily / data.activeResidents) * 100) : 0}%
              </span>
              <span className="text-sm text-muted-foreground">
                {n(data.withFamily)} of {n(data.activeResidents)} residents
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Add family from each resident&apos;s page.</p>
          </ChartCard>
          <ChartCard
            title="Where each facility relationship stands"
            subtitle={`${n(data.facilitiesTotal - data.noJewishResidentsKnown)} facilities${data.noJewishResidentsKnown > 0 ? ` · ${n(data.noJewishResidentsKnown)} with no Jewish residents known not shown` : ""}`}
          >
            <SplitBar data={data.stages} />
          </ChartCard>
        </div>
        {famTrend.length > 1 ? (
          <ChartCard title="Family connection over time" subtitle="Of the residents we'd met by each month, the share with family we're in touch with · last 12 months">
            <PercentLine
              data={famTrend.map((f) => ({ label: f.label, percent: f.percent, detail: `${n(f.connected)} of ${n(f.known)} residents` }))}
              color={SERIES.families}
              goal={famGoal.percent ?? undefined}
              goalLabel={famGoal.by ? `Goal ${famGoal.percent}% by ${formatDateOnly(famGoal.by)}` : `Goal ${famGoal.percent}%`}
            />
          </ChartCard>
        ) : null}
        {growth ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="New residents per quarter" subtitle="First entry naming them">
              <MonthBars data={growth.newResidents} colors={[SERIES.residents]} names={["new residents"]} />
            </ChartCard>
            <ChartCard title="New facilities per quarter" subtitle="First entry there, calls included">
              <MonthBars data={growth.newFacilities} colors={[SECTION_COLORS.coverage]} names={["new facilities"]} />
            </ChartCard>
            <ChartCard title="New volunteers per quarter" subtitle="First visit or meeting logged">
              <MonthBars data={growth.newVolunteers} colors={[SERIES.volunteers]} names={["new volunteers"]} />
            </ChartCard>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TeamTable({
  head,
  rows,
  empty = "Nothing logged in this period yet.",
}: {
  head: string[];
  rows: { id: string; name: string; href: string; cells: number[] }[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-1 py-1 font-medium">Name</th>
            {head.map((h) => (
              <th key={h} className="px-1 py-1 text-right font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-1 py-1.5">
                <Link href={r.href} className="font-medium text-primary underline-offset-4 hover:underline">
                  {r.name}
                </Link>
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className="px-1 py-1.5 text-right tabular-nums">
                  {n(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
