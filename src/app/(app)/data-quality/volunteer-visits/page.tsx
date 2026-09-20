import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getVolunteerVisitGaps } from "@/lib/queries/data-quality";
import { formatDateTime } from "@/lib/format-date";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default async function VolunteerVisitGapsPage() {
  const gaps = await getVolunteerVisitGaps();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/data-quality">
            <ArrowLeft className="size-4" />
            Back to data quality
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Volunteer visits missing a volunteer</h1>
        <p className="text-sm text-muted-foreground">
          {gaps.length === 0
            ? "Every logged volunteer visit has someone checked off."
            : `${gaps.length} logged visit${gaps.length === 1 ? "" : "s"} with nobody checked off in "Volunteers involved" — tap one to fix it.`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visits to tag</CardTitle>
        </CardHeader>
        <CardContent>
          {gaps.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Nothing left to tag.</span>
            </div>
          ) : (
            <ul className="flex flex-col">
              {gaps.map((gap) => (
                <li key={gap.id} className="border-b border-border py-2 last:border-0">
                  <Link
                    href={gap.href}
                    className="flex items-center justify-between gap-3 text-sm hover:text-primary"
                  >
                    <span className="font-medium">
                      {gap.resident_name ?? gap.facility_name ?? "Untitled visit"}
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {gap.facility_name ? `${gap.facility_name} · ` : ""}
                      {formatDateTime(gap.occurred_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
