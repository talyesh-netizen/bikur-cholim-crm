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
import { InfoTip } from "@/components/info-tip";

const n = (v: number) => v.toLocaleString("en-US");

/** One number with a few words under it; the full definition is behind
 * the "i" (director, Oct 27, 2026 QA). */
function Stat({ label, value, short, full }: { label: string; value: number; short: string; full: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        <InfoTip label={label}>{full}</InfoTip>
      </dt>
      <dd className="text-2xl font-bold tabular-nums">{n(value)}</dd>
      <dd className="text-xs text-muted-foreground">{short}</dd>
    </div>
  );
}

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
          detail={`interactions · ${n(h.staffPeople)} staff · ${n(h.staffFacilities)} facilities`}
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

      {/* Facility numbers, kept apart on purpose (director, Oct 21,
          2026): each facility counts once per day; phone calls and
          off-site programs never make a visit. Staff visits per person
          beside them (Oct 27, 2026). */}
      <section aria-labelledby="facility-presence" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="facility-presence" className="text-base font-semibold">Facility visits {periodPhrase}</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Staff visits" value={h.staffVisits} short="per person, per day" full="Each staff member once per facility per day they were there in person." />
          <Stat label="Facility visit-days" value={h.visitDays} short="per facility, per day" full="Days our staff were at a facility in person, each facility once a day however many staff went." />
          <Stat label="Volunteer-only visits" value={h.volunteerOnlyDays} short="only volunteers there" full="Days only volunteers were at a facility (no staff), each facility once a day." />
          <Stat label="Total facility presence" value={h.presenceDays} short="staff or volunteers" full="Days anyone from Bikur Cholim was at a facility (staff, volunteers or both), each facility once a day." />
          <Stat label="Facilities visited" value={h.facilitiesVisited} short="different facilities" full="Different facilities we were at in person." />
          <Stat label="Facilities engaged" value={h.facilitiesEngaged} short="any contact" full="Different facilities with any contact at all, calls and emails included." />
        </dl>
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{n(h.volunteerVisits)}</span> volunteer visits
          </span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">{n(h.partnerConversations)}</span> partner conversations
            <span className="text-xs"> ({n(h.partnerPeople)} people)</span>{" "}
            <InfoTip label="Partner conversations">
              Conversations with schools, shuls, hospices, agencies and other partners, each person once per conversation. Never counted as facility staff.
            </InfoTip>
          </span>
        </p>
      </section>

      {/* Programs (Oct 27, 2026): one entry each, students and volunteers
          asked separately; older entries' single number is "not split". */}
      {h.programs > 0 ? (
        <section aria-labelledby="programs" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <h2 id="programs" className="text-base font-semibold">Programs {periodPhrase}</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Programs" value={h.programs} short="facility, school & shul" full="Facility, school and shul programs, each counted once." />
            <Stat label="Students" value={h.groupStudents} short="each group once" full="Students who took part, each group counted once however many facilities its project reached." />
            <Stat label="Volunteers" value={h.groupVolunteers} short="each group once" full="Volunteers who took part, each group counted once however many facilities its project reached." />
            <Stat label="Not split" value={h.groupNotSplit} short="older entries" full="Programs saved before students and volunteers were asked separately: the one number they had, students and volunteers together." />
          </dl>
        </section>
      ) : null}

      {o.asFirstRecorded && o.corrections ? (
        <section aria-label="Corrections" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="font-medium">
            {o.corrections.entries === 1
              ? "1 entry in this period was corrected (reviewed as a copy of another, or voided), so it no longer counts."
              : `${n(o.corrections.entries)} entries in this period were corrected (reviewed as copies of others, or voided), so they no longer count.`}
          </p>
          <p className="text-muted-foreground">
            As first recorded: {n(o.asFirstRecorded.residentContacts)} visits &amp; calls, {n(o.asFirstRecorded.familyConversations)}{" "}
            family conversations, {n(o.asFirstRecorded.staffTouchpoints)} staff interactions. Corrected (above):{" "}
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
          <MonthBars data={o.familyByMonth} colors={[SERIES.families]} names={["conversations"]} />
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
        <ChartCard title="Staff interactions per month" subtitle={`Each staff person spoken with, once per conversation · ${period.from ? period.label : "last 6 months"}`}>
          <MonthBars data={o.staffByMonth} colors={[SERIES.staff]} names={["staff interactions"]} />
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
            <ChartCard title="Staff" subtitle="Interactions logged (volunteer-only visits not included)">
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
