import { getNeedsAttention, NO_VISIT_DAYS, type AttentionResident } from "@/lib/queries/needs-attention";
import { formatRelative } from "@/lib/format-date";
import { AttentionGroup as Group } from "./attention-group";

export default async function NeedsAttentionPage() {
  const { locationUnknown, missingName, noRecentVisit } = await getNeedsAttention();
  const facility = (r: AttentionResident) => r.current_facility_name ?? "Current location unknown";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Needs attention</h1>
        <p className="text-sm text-muted-foreground">
          Residents worth looking into. Tap anyone to open their page. Only residents you have access to are shown.
        </p>
      </div>

      <Group
        title="Location unknown"
        explanation="We don't know where they are living right now. Try to find out, then use “Move to another facility”."
        residents={locationUnknown}
        detail={(r) => (r.last_visit_at ? `Last visit ${formatRelative(r.last_visit_at)}` : "No visits logged")}
      />
      <Group
        title={`No visit in ${NO_VISIT_DAYS}+ days`}
        explanation="Active residents nobody has visited recently. Longest wait first."
        residents={noRecentVisit}
        detail={(r) => `${facility(r)} · ${r.last_visit_at ? `last visit ${formatRelative(r.last_visit_at)}` : "never visited"}`}
      />
      <Group
        title="Missing a name"
        explanation="Saved with only a first or last name. Fill in the other when you learn it."
        residents={missingName}
        detail={(r) => `${facility(r)} · ${!r.last_name?.trim() ? "last name missing" : "first name missing"}`}
      />
    </div>
  );
}
