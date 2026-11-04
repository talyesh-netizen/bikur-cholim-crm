import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNeedsAttention, NO_VISIT_DAYS, type AttentionResident } from "@/lib/queries/needs-attention";
import { getFacilitiesNeedingAttention } from "@/lib/queries/dashboard";
import { formatRelative } from "@/lib/format-date";
import { AttentionGroup as Group } from "./attention-group";

export default async function NeedsAttentionPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const showAll = (await searchParams).all === "1";
  const [{ locationUnknown, noFacility, missingName, noRecentVisit }, facilities] = await Promise.all([
    getNeedsAttention(),
    getFacilitiesNeedingAttention(),
  ]);
  const facility = (r: AttentionResident) => r.current_facility_name ?? "No facility recorded";
  // In-person visits and other contact kept apart (Q3, Nov 3, 2026).
  const lastContact = (r: AttentionResident) =>
    r.last_contact_at && r.last_contact_at !== r.last_visit_at ? ` · last contact ${formatRelative(r.last_contact_at)}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Needs attention</h1>
        <p className="text-sm text-muted-foreground">
          The full list to work through. Tap anyone to open their page. Only what you have access to is shown.
        </p>
      </div>

      <Group
        showAll={showAll}
        title="Location unknown"
        explanation="We don't know where they are living right now. Try to find out, then use “Move to another facility”."
        residents={locationUnknown}
        detail={(r) => `${r.last_visit_at ? `Last in-person visit ${formatRelative(r.last_visit_at)}` : "No in-person visits logged"}${lastContact(r)}`}
      />
      <Group
        showAll={showAll}
        title="No facility recorded"
        explanation="No facility is on file for them. If they live at home, that's fine: calls and visits can be logged without a facility. Otherwise, use “Move to another facility”."
        residents={noFacility}
        detail={(r) => `${r.last_visit_at ? `Last in-person visit ${formatRelative(r.last_visit_at)}` : "No in-person visits logged"}${lastContact(r)}`}
      />
      <Group
        showAll={showAll}
        title={`No in-person visit in ${NO_VISIT_DAYS}+ days`}
        explanation="Active residents nobody has visited in person recently. Phone calls are shown beside it but don't count as a visit. Longest wait first."
        residents={noRecentVisit}
        detail={(r) => `${facility(r)} · ${r.last_visit_at ? `last in-person visit ${formatRelative(r.last_visit_at)}` : "no in-person visit yet"}${lastContact(r)}`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Facilities to check on
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {facilities.length}
            </span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Marked &ldquo;follow up needed&rdquo;, or high priority with nothing logged in two weeks.
          </p>
        </CardHeader>
        <CardContent>
          {facilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing right now.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {facilities.map((f) => (
                <Link
                  key={f.id}
                  href={`/facilities/${f.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-primary"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.engagement_status === "follow_up_needed" ? "Follow up needed · " : ""}
                      {f.last_visit_at ? `last contact ${formatRelative(f.last_visit_at)}` : "nothing logged yet"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Group
        showAll={showAll}
        title="Missing a name"
        explanation="Saved with only a first or last name. Fill in the other when you learn it."
        residents={missingName}
        detail={(r) => `${facility(r)} · ${!r.last_name?.trim() ? "last name missing" : "first name missing"}`}
      />
    </div>
  );
}
