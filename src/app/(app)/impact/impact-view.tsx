import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ImpactOverview } from "@/lib/queries/impact-overview";
import type { PersonImpactRow } from "@/lib/queries/impact";
import { ImpactLeaderboard } from "@/components/impact-leaderboard";
import type { ReportPeriod } from "@/lib/report-period";
import { PeriodPicker } from "@/components/period-picker";
import { ChartCard, HBars, HeadlineTile, Legend, MonthBars, PercentLine, SERIES, SplitBar } from "@/components/impact/charts";
import type { ImpactGrowth } from "@/lib/queries/impact-growth";
import { IMPACT_GOALS } from "@/lib/impact-goals";
import { formatDateOnly } from "@/lib/format-date";
import { Download } from "lucide-react";

const n = (v: number) => v.toLocaleString("en-US");

function Section({ id, color, title, intro, children }: { id: string; color: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="flex items-center gap-2.5 text-xl font-bold">
          <span aria-hidden className="size-3 rounded-[3px]" style={{ backgroundColor: color }} />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function ImpactView({
  period,
  choices,
  o,
  growth,
  team,
  fellBackToAllTime = false,
}: {
  growth?: ImpactGrowth;
  fellBackToAllTime?: boolean;
  period: ReportPeriod;
  /** What the period picker offers. */
  choices: { quick: { key: string; label: string }[]; months: { key: string; label: string }[]; quarters: { key: string; label: string }[] };
  o: ImpactOverview;
  team?: { staff: PersonImpactRow[]; volunteers: PersonImpactRow[] };
}) {
  const p = period;
  const h = o.headline;
  const prev = o.previous;
  const periodPhrase = period.from ? `in ${period.label}` : "so far";
  const periodLink = period.from ? `&from=${period.from}&to=${period.to}` : "";
  const famGoal = IMPACT_GOALS.familyConnection;
  // Months before we'd met anyone have no percentage to show.
  const famTrend = (growth?.familyConnection ?? []).filter((f) => f.known > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Our impact</h1>
          <p className="text-muted-foreground">Residents, families and facility staff we supported {periodPhrase}.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <PeriodPicker basePath="/impact" currentKey={period.key} {...choices} />
          <Button asChild>
            <a href={`/api/impact-report?period=${encodeURIComponent(period.key)}`}>
              <Download className="size-4" />
              Export for funders
            </a>
          </Button>
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
          href={o.headlineLinks.residents}
          value={n(h.residents)}
          detail={`different residents · ${n(h.residentContacts)} visits & calls`}
          current={h.residents}
          previous={prev?.residents ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.families}
          label="Families supported"
          href={o.headlineLinks.families}
          value={n(h.families)}
          detail={`families · ${n(h.familyConversations)} conversations`}
          current={h.families}
          previous={prev?.families ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.staff}
          label="Facility staff supported"
          href={o.headlineLinks.staff}
          value={n(h.staffTouchpoints)}
          detail={`staff meetings & conversations · ${n(h.staffPeople)} different staff · ${n(h.staffFacilities)} facilities`}
          current={h.staffTouchpoints}
          previous={prev?.staffTouchpoints ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.reached}
          label="Reached at programs & deliveries"
          href={o.headlineLinks.reached}
          value={h.reached > 0 ? `~${n(h.reached)}` : "0"}
          detail={`approx. attendance · ${n(h.programs)} programs, ${n(h.deliveries)} deliveries`}
          current={h.reached}
          previous={prev?.reached ?? null}
          periodWord={p.word}
        />
      </section>

      {/* Four facility numbers, kept apart on purpose (director, Oct 21,
          2026): each facility counts once per day; phone calls and
          off-site programs never make a visit. */}
      <section aria-labelledby="facility-presence" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="facility-presence" className="text-base font-semibold">Facility visits {periodPhrase}</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="text-sm text-muted-foreground">Staff visits</dt>
            <dd className="text-2xl font-bold tabular-nums">{n(h.visitDays)}</dd>
            <dd className="text-xs text-muted-foreground">days our staff were at a facility, each facility once a day</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Volunteer-only visits</dt>
            <dd className="text-2xl font-bold tabular-nums">{n(h.volunteerOnlyDays)}</dd>
            <dd className="text-xs text-muted-foreground">days only volunteers were there</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Total facility presence</dt>
            <dd className="text-2xl font-bold tabular-nums">{n(h.presenceDays)}</dd>
            <dd className="text-xs text-muted-foreground">staff, volunteers or both, each facility once a day</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Facilities visited</dt>
            <dd className="text-2xl font-bold tabular-nums">{n(h.facilitiesVisited)}</dd>
            <dd className="text-xs text-muted-foreground">different facilities we were at</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Facilities engaged</dt>
            <dd className="text-2xl font-bold tabular-nums">{n(h.facilitiesEngaged)}</dd>
            <dd className="text-xs text-muted-foreground">different facilities with any contact, calls included</dd>
          </div>
        </dl>
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{n(h.volunteerVisits)}</span> volunteer visits
          </span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">{n(h.groupVolunteers)}</span> group volunteers
            <span className="text-xs">
              {" "}
              ({n(h.groupProjects)} school, shul &amp; community {h.groupProjects === 1 ? "project" : "projects"}, each counted once)
            </span>
          </span>
        </p>
      </section>

      {o.asFirstRecorded && o.corrections ? (
        <section aria-label="Corrections" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="font-medium">
            {o.corrections.entries === 1
              ? "1 entry in this period was corrected (reviewed as a copy of another, or voided), so it no longer counts."
              : `${n(o.corrections.entries)} entries in this period were corrected (reviewed as copies of others, or voided), so they no longer count.`}
          </p>
          <p className="text-muted-foreground">
            As first recorded: {n(o.asFirstRecorded.residentContacts)} visits &amp; calls, {n(o.asFirstRecorded.familyConversations)}{" "}
            family conversations, {n(o.asFirstRecorded.staffTouchpoints)} staff meetings. Corrected (above):{" "}
            {n(h.residentContacts)}, {n(h.familyConversations)}, {n(h.staffTouchpoints)}.{" "}
            <Link href={o.corrections.href} className="font-medium text-primary underline-offset-4 hover:underline">
              See the corrected entries
            </Link>
          </p>
        </section>
      ) : null}

      <Section id="res" color={SERIES.residents} title="Resident impact" intro="Who we're seeing, how often, and who might be slipping through the cracks.">
        <ChartCard title="Visits & calls per month" subtitle={`Staff and volunteers · ${period.from ? period.label : "last 6 months"}`}>
          <Legend items={[{ label: "Staff", color: SERIES.residents }, { label: "Volunteers", color: SERIES.volunteers }]} />
          <MonthBars data={o.visitsByMonth} colors={[SERIES.residents, SERIES.volunteers]} names={["by staff", "by volunteers"]} />
        </ChartCard>
        <ChartCard title="Time since last visit" subtitle={`${n(o.activeResidents)} active residents, today`}>
          <HBars data={o.recency} color={SERIES.residents} />
          {o.notVisited30 > 0 ? (
            <Link href="/needs-attention" className="rounded-lg bg-tone-attention-bg px-3 py-2 text-sm text-tone-attention-fg hover:underline">
              {n(o.notVisited30)} of {n(o.activeResidents)} haven&apos;t had a visit in 30+ days → Needs attention
            </Link>
          ) : null}
        </ChartCard>
        <ChartCard title="Reached by holiday" subtitle={`Visits, programs and deliveries tagged with a holiday · ${p.label.toLowerCase()}`}>
          {o.holidays.length > 0 ? (
            <HBars data={o.holidays} color={SERIES.residents} labelWidth={110} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing tagged with a holiday yet. Pick “For a holiday?” when logging a visit, program or delivery and it shows here.
            </p>
          )}
        </ChartCard>
      </Section>

      <Section id="fam" color={SERIES.families} title="Family support" intro="How we're keeping families informed and helping them care for their loved ones.">
        <ChartCard title="Family conversations per month" subtitle={`Calls, visits and messages with family · ${period.from ? period.label : "last 6 months"}`}>
          <MonthBars data={o.familyByMonth} colors={[SERIES.families]} names={["meetings & conversations"]} />
        </ChartCard>
        <ChartCard title="Family connections on file" subtitle="Active residents with at least one family contact">
          <div className="flex items-baseline gap-2.5">
            <span className="text-4xl font-bold tracking-tight tabular-nums">
              {o.activeResidents > 0 ? Math.round((o.withFamily / o.activeResidents) * 100) : 0}%
            </span>
            <span className="text-sm text-muted-foreground">
              {n(o.withFamily)} of {n(o.activeResidents)} residents
            </span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-full bg-muted" title={`${o.withFamily} of ${o.activeResidents} have a family contact`}>
            <div
              className="h-3.5"
              style={{ width: `${o.activeResidents > 0 ? (o.withFamily / o.activeResidents) * 100 : 0}%`, backgroundColor: SERIES.families }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {n(o.activeResidents - o.withFamily)} {o.activeResidents - o.withFamily === 1 ? "resident has" : "residents have"} no family on file yet. Add family from each resident&apos;s page.
          </p>
        </ChartCard>
        {famTrend.length > 1 ? (
          <div className="lg:col-span-3">
            <ChartCard
              title="Family connection over time"
              subtitle="Of the residents we'd met by each month, the share with family we're in touch with · last 12 months"
            >
              <PercentLine
                data={famTrend.map((f) => ({
                  label: f.label,
                  percent: f.percent,
                  detail: `${n(f.connected)} of ${n(f.known)} residents`,
                }))}
                color={SERIES.families}
                goal={famGoal.percent ?? undefined}
                goalLabel={famGoal.by ? `Goal ${famGoal.percent}% by ${formatDateOnly(famGoal.by)}` : `Goal ${famGoal.percent}%`}
              />
            </ChartCard>
          </div>
        ) : null}
      </Section>

      {growth ? (
        <Section id="growth" color={SERIES.reached} title="Growth" intro="New people and places we started working with each quarter (counted from the first time we logged working with them).">
          <ChartCard title="New residents per quarter" subtitle="First visit or call logged">
            <MonthBars data={growth.newResidents} colors={[SERIES.residents]} names={["new residents"]} />
          </ChartCard>
          <ChartCard title="New facilities per quarter" subtitle="First visit, call or meeting there logged">
            <MonthBars data={growth.newFacilities} colors={[SERIES.staff]} names={["new facilities"]} />
          </ChartCard>
          <ChartCard title="New volunteers per quarter" subtitle="First visit or meeting logged">
            <MonthBars data={growth.newVolunteers} colors={[SERIES.volunteers]} names={["new volunteers"]} />
          </ChartCard>
        </Section>
      ) : null}

      <Section id="staff" color={SERIES.staff} title="Staff & facility support" intro="The relationships with facility teams that open the door to residents.">
        <ChartCard title="Staff meetings & conversations per month" subtitle={`Each meeting once, however many staff · ${period.from ? period.label : "last 6 months"}`}>
          <MonthBars data={o.staffByMonth} colors={[SERIES.staff]} names={["meetings & conversations"]} />
        </ChartCard>
        <ChartCard
          title="Where each facility relationship stands"
          subtitle={`${n(o.facilitiesTotal - o.noJewishResidentsKnown)} facilities${o.noJewishResidentsKnown > 0 ? ` · ${n(o.noJewishResidentsKnown)} with no Jewish residents known not shown` : ""}`}
        >
          <SplitBar data={o.stages} />
        </ChartCard>
        <ChartCard title="Most-supported facility teams" subtitle={`Staff conversations · ${p.label.toLowerCase()} · tap to open`}>
          {o.topFacilities.length > 0 ? (
            <HBars data={o.topFacilities} color={SERIES.staff} labelWidth={150} />
          ) : (
            <p className="text-sm text-muted-foreground">No staff conversations logged {periodPhrase}.</p>
          )}
        </ChartCard>
      </Section>

      {team ? (
        <section aria-labelledby="team" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="team" className="text-xl font-bold">Team</h2>
            <p className="text-sm text-muted-foreground">Who did the work {periodPhrase}. Tap a staff member to see their entries.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Staff" subtitle="Interactions logged">
              <ImpactLeaderboard
                rows={team.staff}
                hrefFor={(row) => `/interactions?staff=${row.id}${periodLink}`}
                barColor={SERIES.residents}
                emptyMessage="Nothing logged in this period yet."
              />
            </ChartCard>
            <ChartCard title="Volunteers" subtitle="Visits">
              <ImpactLeaderboard
                rows={team.volunteers}
                hrefFor={(row) => `/contacts/${row.id}`}
                barColor={SERIES.reached}
                emptyMessage="No volunteer visits in this period yet."
              />
            </ChartCard>
          </div>
        </section>
      ) : null}
    </div>
  );
}
