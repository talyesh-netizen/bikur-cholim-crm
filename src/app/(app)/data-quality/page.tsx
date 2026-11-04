import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDataQualityReport,
  getVolunteerVisitGapCount,
  getUnreviewedCountsByType,
} from "@/lib/queries/data-quality";
import type { DataQualityRow } from "@/lib/queries/data-quality";
import { listDoubleEntries } from "@/lib/queries/double-entries";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getImpactMetrics } from "@/lib/queries/impact-metrics";
import { ALL_TIME } from "@/lib/report-period";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { SectionIcon } from "@/components/section-icon";
import { ClipboardCheck } from "lucide-react";

function Section({ title, rows }: { title: string; rows: DataQualityRow[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {rows.length > 0 ? <Badge variant="warning">{rows.length}</Badge> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Nothing missing here.</span>
          </div>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li key={row.id} className="border-b border-border py-2 last:border-0">
                <Link href={row.href} className="flex items-center justify-between gap-3 text-sm hover:text-primary">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-xs text-muted-foreground">Missing {row.missing}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DataQualityPage() {
  const [report, volunteerVisitGapCount, unreviewedCounts, doubleEntries, profile, allTime] = await Promise.all([
    getDataQualityReport(),
    getVolunteerVisitGapCount(),
    getUnreviewedCountsByType(),
    listDoubleEntries(),
    getCurrentProfile(),
    getImpactMetrics(ALL_TIME),
  ]);
  // To confirm by hand, one at a time (Q5 and C2, Nov 3, 2026).
  const foodNotRecorded = allTime.values.food_not_recorded ?? 0;
  const attendanceNotRecorded = allTime.values.attendance_not_recorded_entries ?? 0;
  const doubleEntryCount = doubleEntries.open.length;
  // Only admins answer double entries, so only they see the card
  // (director, Oct 20, 2026: kept out of the everyday staff workflow).
  const isAdmin = profile?.role === "admin";
  const unreviewedTotal = unreviewedCounts.reduce((sum, c) => sum + c.count, 0);
  const totalGaps =
    report.contactsMissingPhone.length +
    report.contactsMissingEmail.length +
    report.facilitiesMissingPhone.length +
    report.facilitiesMissingAddress.length +
    report.organizationsMissingPhone.length +
    volunteerVisitGapCount;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <SectionIcon section="neutral" icon={ClipboardCheck} />
            Data Quality
          </h1>
        <p className="text-sm text-muted-foreground">
          {totalGaps} gap{totalGaps === 1 ? "" : "s"} across active records — tap a gap to fix it.
        </p>
      </div>

      {isAdmin ? (
      <Link href="/data-quality/double-entries">
        <Card className="transition-colors hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Possible double entries</CardTitle>
            <div className="flex items-center gap-2">
              {doubleEntryCount > 0 ? <Badge variant="warning">{doubleEntryCount}</Badge> : null}
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Same visit saved twice (often once by each staff member there)? Review each pair so reports count it once.
            </p>
          </CardContent>
        </Card>
      </Link>
      ) : null}

      <Link href="/data-quality/review-entries">
        <Card className="transition-colors hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Review past entries</CardTitle>
            <div className="flex items-center gap-2">
              {unreviewedTotal > 0 ? <Badge variant="warning">{unreviewedTotal}</Badge> : null}
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {unreviewedTotal === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Every past entry has been reviewed.</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Entries logged before food deliveries, rides, medical referrals, care navigation and shul programs had
                their own types — confirm or fix each one so they count in the funder report.
              </p>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/data-quality/volunteer-visits">
        <Card className="transition-colors hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Volunteer visits missing a volunteer</CardTitle>
            <div className="flex items-center gap-2">
              {volunteerVisitGapCount > 0 ? <Badge variant="warning">{volunteerVisitGapCount}</Badge> : null}
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {volunteerVisitGapCount === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Nothing missing here.</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Logged visits where nobody&apos;s checked off in &quot;Volunteers involved&quot; — tap to see the full list.
              </p>
            )}
          </CardContent>
        </Card>
      </Link>

      <ConfirmCard
        href="/impact/records?metric=attendance_not_recorded&period=all"
        title="Staff attendance not recorded"
        count={attendanceNotRecorded}
        text="Older programs, food deliveries and volunteer visits that don't say whether staff were there (unknown, not absent). Open one and answer who was there. The ones that decide a facility-day are listed first."
      />
      <ConfirmCard
        href="/impact/records?metric=food_not_recorded&period=all"
        title="Food deliveries with no people count"
        count={foodNotRecorded}
        text="Deliveries where “How many people received food?” is blank. They're shown as not recorded, never guessed. Fill one in if you know it."
      />

      <Section title="Contacts missing a phone number" rows={report.contactsMissingPhone} />
      <Section title="Contacts missing an email" rows={report.contactsMissingEmail} />
      <Section title="Facilities missing a main phone number" rows={report.facilitiesMissingPhone} />
      <Section title="Facilities missing an address" rows={report.facilitiesMissingAddress} />
      <Section title="Organizations missing a main phone number" rows={report.organizationsMissingPhone} />
    </div>
  );
}

function ConfirmCard({ href, title, count, text }: { href: string; title: string; count: number; text: string }) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-foreground/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {count > 0 ? <Badge variant="warning">{count}</Badge> : null}
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {count === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Nothing to confirm.</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{text}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
