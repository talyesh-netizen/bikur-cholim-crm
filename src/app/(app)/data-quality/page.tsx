import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDataQualityReport } from "@/lib/queries/data-quality";
import type { DataQualityRow } from "@/lib/queries/data-quality";
import { CheckCircle2 } from "lucide-react";

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
  const report = await getDataQualityReport();
  const totalGaps =
    report.contactsMissingPhone.length +
    report.contactsMissingEmail.length +
    report.facilitiesMissingPhone.length +
    report.facilitiesMissingAddress.length +
    report.organizationsMissingPhone.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Data quality</h1>
        <p className="text-sm text-muted-foreground">
          {totalGaps} gap{totalGaps === 1 ? "" : "s"} across active records — click any name to fix it directly.
        </p>
      </div>

      <Section title="Contacts missing a phone number" rows={report.contactsMissingPhone} />
      <Section title="Contacts missing an email" rows={report.contactsMissingEmail} />
      <Section title="Facilities missing a main phone number" rows={report.facilitiesMissingPhone} />
      <Section title="Facilities missing an address" rows={report.facilitiesMissingAddress} />
      <Section title="Organizations missing a main phone number" rows={report.organizationsMissingPhone} />
    </div>
  );
}
