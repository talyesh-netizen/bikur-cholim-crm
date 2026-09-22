import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDataQualityReport, getVolunteerVisitGapCount } from "@/lib/queries/data-quality";
import type { DataQualityRow } from "@/lib/queries/data-quality";
import { CheckCircle2, ChevronRight } from "lucide-react";

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
  const [report, volunteerVisitGapCount] = await Promise.all([
    getDataQualityReport(),
    getVolunteerVisitGapCount(),
  ]);
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
        <h1 className="text-2xl font-semibold">Data Quality</h1>
        <p className="text-sm text-muted-foreground">
          {totalGaps} gap{totalGaps === 1 ? "" : "s"} across active records — tap a gap to fix it.
        </p>
      </div>

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

      <Section title="Contacts missing a phone number" rows={report.contactsMissingPhone} />
      <Section title="Contacts missing an email" rows={report.contactsMissingEmail} />
      <Section title="Facilities missing a main phone number" rows={report.facilitiesMissingPhone} />
      <Section title="Facilities missing an address" rows={report.facilitiesMissingAddress} />
      <Section title="Organizations missing a main phone number" rows={report.organizationsMissingPhone} />
    </div>
  );
}
