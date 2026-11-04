import Link from "next/link";
import { METRICS, SECTIONS, recordsHref, type ImpactNumbers } from "@/lib/queries/impact-metrics";
import type { ReportPeriod } from "@/lib/report-period";
import { InfoTip } from "@/components/info-tip";

const n = (v: number) => v.toLocaleString("en-US");

/** A facility's numbers, with the same definitions and sections as the
 * Impact page (Q7, Nov 3, 2026); only the ones that apply (non-zero) are
 * shown, each a tap away from its records at this facility. */
export function FacilityNumbers({ values, period, facilityId }: { values: ImpactNumbers; period: ReportPeriod; facilityId: string }) {
  const sections = SECTIONS.map((s) => ({
    ...s,
    metrics: METRICS.filter((m) => m.section === s.key && (values[m.key] ?? 0) > 0 && m.key !== "facilities_engaged" && m.key !== "facilities_with_activity" && m.key !== "facilities_with_staff" && m.key !== "staff_facilities"),
  })).filter((s) => s.metrics.length > 0);
  if (sections.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => (
        <div key={s.key} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {s.metrics.map((m) => (
              <div key={m.key} className="rounded-lg border border-border p-3">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  {m.label}
                  <InfoTip label={m.label}>{m.full}</InfoTip>
                </dt>
                <dd className="text-xl font-semibold tabular-nums">
                  <Link href={recordsHref(m.key, period, facilityId)} className="underline-offset-4 hover:underline">
                    {m.approx ? "~" : ""}
                    {n(values[m.key] ?? 0)}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
