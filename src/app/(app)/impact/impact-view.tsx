import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ImpactOverview } from "@/lib/queries/impact-overview";
import type { PersonImpactRow } from "@/lib/queries/impact";
import { ImpactLeaderboard } from "@/components/impact-leaderboard";
import type { ImpactPeriod } from "@/lib/queries/impact";
import { ChartCard, HBars, HeadlineTile, Legend, MonthBars, SERIES, SplitBar } from "@/components/impact/charts";
import { Download } from "lucide-react";

const PERIODS: { value: ImpactPeriod; label: string; word: string | null }[] = [
  { value: "month", label: "This month", word: "month" },
  { value: "quarter", label: "This quarter", word: "quarter" },
  { value: "all", label: "All time", word: null },
];

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
  o,
  team,
  fellBackToAllTime = false,
}: {
  fellBackToAllTime?: boolean;
  period: ImpactPeriod;
  o: ImpactOverview;
  team?: { staff: PersonImpactRow[]; volunteers: PersonImpactRow[]; periodFrom: string | null };
}) {
  const p = PERIODS.find((x) => x.value === period)!;
  const h = o.headline;
  const prev = o.previous;
  const periodPhrase = period === "all" ? "so far" : `this ${p.word}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Our impact</h1>
          <p className="text-muted-foreground">Residents, families and facility staff we supported {periodPhrase}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Time period" className="flex gap-1 rounded-lg bg-muted p-1">
            {PERIODS.map((x) => (
              <Link
                key={x.value}
                href={x.value === "quarter" ? "/impact" : `/impact?period=${x.value}`}
                aria-current={x.value === period ? "true" : undefined}
                className={
                  x.value === period
                    ? "rounded-md bg-card px-3 py-2 text-sm font-semibold shadow-sm"
                    : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {x.label}
              </Link>
            ))}
          </div>
          <Button asChild>
            <a href={`/api/impact-report?period=${period}`}>
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
          value={n(h.residents)}
          detail={`different residents · ${n(h.residentContacts)} visits & calls`}
          current={h.residents}
          previous={prev?.residents ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.families}
          label="Families supported"
          value={n(h.families)}
          detail={`families · ${n(h.familyConversations)} conversations`}
          current={h.families}
          previous={prev?.families ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.staff}
          label="Facility staff supported"
          value={n(h.staffTouchpoints)}
          detail={`staff touchpoints · ${n(h.staffFacilities)} facilities`}
          current={h.staffTouchpoints}
          previous={prev?.staffTouchpoints ?? null}
          periodWord={p.word}
        />
        <HeadlineTile
          color={SERIES.reached}
          label="Reached at programs & deliveries"
          value={h.reached > 0 ? `~${n(h.reached)}` : "0"}
          detail={`approx. attendance · ${n(h.programs)} programs, ${n(h.deliveries)} deliveries`}
          current={h.reached}
          previous={prev?.reached ?? null}
          periodWord={p.word}
        />
      </section>

      <Section id="res" color={SERIES.residents} title="Resident impact" intro="Who we're seeing, how often, and who might be slipping through the cracks.">
        <ChartCard title="Visits & calls per month" subtitle="Staff and volunteers, last 6 months">
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
        <ChartCard title="Family conversations per month" subtitle="Calls, visits and messages with family, last 6 months">
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
            {n(o.activeResidents - o.withFamily)} residents have no family on file yet. Add family from each resident&apos;s page.
          </p>
        </ChartCard>
        <ChartCard title="What families needed" subtitle={`Family support conversations · ${p.label.toLowerCase()}`}>
          {o.familyNeeds.length > 0 ? (
            <HBars data={o.familyNeeds} color={SERIES.families} labelWidth={170} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Shows here once family support is logged with “What did the family need?” picked.
            </p>
          )}
        </ChartCard>
      </Section>

      <Section id="staff" color={SERIES.staff} title="Staff & facility support" intro="The relationships with facility teams that open the door to residents.">
        <ChartCard title="Staff touchpoints per month" subtitle="Meetings, check-ins, appreciation and first visits, last 6 months">
          <MonthBars data={o.staffByMonth} colors={[SERIES.staff]} names={["touchpoints"]} />
        </ChartCard>
        <ChartCard
          title="Where each facility relationship stands"
          subtitle={`${n(o.facilitiesTotal - o.noJewishResidentsKnown)} facilities${o.noJewishResidentsKnown > 0 ? ` · ${n(o.noJewishResidentsKnown)} with no Jewish residents known not shown` : ""}`}
        >
          <SplitBar data={o.stages} />
        </ChartCard>
        <ChartCard title="Most-supported facility teams" subtitle={`Staff touchpoints · ${p.label.toLowerCase()} · tap to open`}>
          {o.topFacilities.length > 0 ? (
            <HBars data={o.topFacilities} color={SERIES.staff} labelWidth={150} />
          ) : (
            <p className="text-sm text-muted-foreground">No staff touchpoints logged {periodPhrase}.</p>
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
                hrefFor={(row) => `/interactions?staff=${row.id}${team.periodFrom ? `&from=${team.periodFrom}` : ""}`}
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
