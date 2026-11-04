import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMetricRecords, METRIC_BY_KEY, attendanceLabel } from "@/lib/queries/impact-metrics";
import { listInteractionsByIds } from "@/lib/queries/interactions";
import { parsePeriod, periodQuery } from "@/lib/report-period";
import { INTERACTION_TYPES, labelFor } from "@/lib/domain/interaction";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import { residentName } from "@/lib/domain/resident-name";

const n = (v: number) => v.toLocaleString("en-US");

/** Titles for lists that aren't a number on the Impact page. */
const EXTRA_TITLES: Record<string, { label: string; full: string }> = {
  attendance_not_recorded: {
    label: "Staff attendance not recorded",
    full: "Older programs, food deliveries and volunteer visits at a facility, saved before staff attendance was asked. \"Not recorded\" means unknown: never counted as there, never counted as absent. Open one and answer who was there to confirm it. The ones that decide a facility-day are listed first.",
  },
};

const STATUS_LABEL = { staff: "Staff confirmed", not_recorded: "Staff attendance not recorded", no_staff: "No staff there" } as const;

/**
 * The records behind one Impact number (Q7, Nov 3, 2026): the same
 * calculation as the number, so the list and the number always agree.
 */
export default async function ImpactRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; period?: string; from?: string; to?: string; facility?: string }>;
}) {
  const params = await searchParams;
  const key = params.metric ?? "";
  const period = parsePeriod(params);
  const facilityId = params.facility && /^[0-9a-f-]{36}$/i.test(params.facility) ? params.facility : undefined;
  const isPerson = key.startsWith("staff:") || key.startsWith("volunteer:");
  const def = METRIC_BY_KEY.get(key) ?? EXTRA_TITLES[key] ?? null;
  if (!def && !isPerson) notFound();

  const { lines, days, value, metrics } = await getMetricRecords(period, key, facilityId);
  const supabase = await createClient();

  // Names for people, facilities and organizations shown in the list.
  const personIds = [...new Set((lines ?? []).map((l) => l.person).filter((p): p is string => !!p))];
  const [contacts, residents, facilities, orgs, profiles] = await Promise.all([
    personIds.length ? supabase.from("contacts").select("id, name").in("id", personIds) : Promise.resolve({ data: [] }),
    personIds.length ? supabase.from("residents").select("id, first_name, last_name, preferred_name").in("id", personIds) : Promise.resolve({ data: [] }),
    supabase.from("facilities").select("id, name"),
    personIds.length ? supabase.from("organizations").select("id, name").in("id", personIds) : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const nameOf = new Map<string, string>();
  for (const c of (contacts.data ?? []) as { id: string; name: string }[]) nameOf.set(c.id, c.name);
  for (const r of (residents.data ?? []) as { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null }[])
    nameOf.set(r.id, residentName(r));
  for (const f of (facilities.data ?? []) as { id: string; name: string }[]) nameOf.set(f.id, f.name);
  for (const o of (orgs.data ?? []) as { id: string; name: string }[]) nameOf.set(o.id, o.name);
  const staffName = new Map(((profiles.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  const title = isPerson
    ? key.startsWith("staff:")
      ? `Staff member: ${staffName.get(key.slice(6)) ?? "Unknown"}`
      : `Volunteer: ${metrics.volunteers.find((v) => v.id === key.slice(10))?.name ?? "Volunteer"}`
    : def!.label;
  const backHref = `/impact?${periodQuery(period)}`;
  const facilityName = facilityId ? nameOf.get(facilityId) : null;

  const entries = lines ? await listInteractionsByIds(lines.map((l) => l.id)) : [];
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const dayEntries = days ? await listInteractionsByIds(days.flatMap((d) => d.ids)) : [];
  const dayEntryById = new Map(dayEntries.map((e) => [e.id, e]));

  const totalAdds = (lines ?? []).reduce((s, l) => s + l.adds, 0);
  const distinctPeople = new Set((lines ?? []).map((l) => l.person).filter(Boolean)).size;
  const sortedLines = [...(lines ?? [])].sort((a, b) => (entryById.get(b.id)?.occurred_at ?? "").localeCompare(entryById.get(a.id)?.occurred_at ?? ""));
  // The "attendance not recorded" list keeps the deciding ones first.
  const shownLines = key === "attendance_not_recorded" ? lines ?? [] : sortedLines;

  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to Impact
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {period.label}
          {facilityName ? ` · ${facilityName} only` : ""}
          {value !== null && !isPerson ? ` · ${n(value)}` : ""}
        </p>
        {def && !isPerson ? <p className="max-w-3xl text-sm">{def.full}</p> : null}
      </div>

      {days ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 font-medium">Facility</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Staff there</th>
                <th className="px-3 py-2 font-medium">Not recorded</th>
                <th className="px-3 py-2 font-medium">Entries</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.key} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateOnly(d.day)}</td>
                  <td className="px-3 py-2">{nameOf.get(d.facility_id) ?? "Facility"}</td>
                  <td className="px-3 py-2">
                    {STATUS_LABEL[d.status]}
                    {d.volunteers ? " · volunteers there" : ""}
                  </td>
                  <td className="px-3 py-2">{d.confirmedStaff.map((p) => staffName.get(p) ?? "Unknown").join(", ") || "—"}</td>
                  <td className="px-3 py-2">{d.unverifiedStaff.map((p) => staffName.get(p) ?? "Unknown").join(", ") || "—"}</td>
                  <td className="px-3 py-2">
                    <ul className="flex flex-col gap-0.5">
                      {d.ids.map((id) => {
                        const e = dayEntryById.get(id);
                        return (
                          <li key={id}>
                            <Link href={`/interactions/${id}`} className="text-primary underline-offset-4 hover:underline">
                              {e ? labelFor(INTERACTION_TYPES, e.interaction_type) : "Entry"}
                              {e?.resident_name ? ` · ${e.resident_name}` : ""}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-3 py-2 text-sm font-medium">
            {n(days.length)} facility-day{days.length === 1 ? "" : "s"}
            {key === "staff_visits_confirmed" ? ` · ${n(days.reduce((s, d) => s + d.confirmedStaff.length, 0))} staff visits` : ""}
            {key === "staff_visits_not_recorded" ? ` · ${n(days.reduce((s, d) => s + d.unverifiedStaff.length, 0))} staff visits not recorded` : ""}
            {key.startsWith("facilities_") ? ` · ${n(new Set(days.map((d) => d.facility_id)).size)} different facilities` : ""}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          {shownLines.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No records for this number in {period.label.toLowerCase()}.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Facility</th>
                  <th className="px-3 py-2 font-medium">Who</th>
                  <th className="px-3 py-2 font-medium">Done by</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 text-right font-medium">Adds</th>
                </tr>
              </thead>
              <tbody>
                {shownLines.map((l, i) => {
                  const e = entryById.get(l.id);
                  const who = l.person ? nameOf.get(l.person) ?? e?.resident_name ?? e?.contact_name : e?.resident_name ?? e?.contact_name;
                  return (
                    <tr key={`${l.id}-${i}`} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link href={`/interactions/${l.id}`} className="text-primary underline-offset-4 hover:underline">
                          {formatDateTime(e?.occurred_at) ?? "Entry"}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{e ? labelFor(INTERACTION_TYPES, e.interaction_type) : ""}</td>
                      <td className="px-3 py-2">{e?.facility_name ?? "No facility"}</td>
                      <td className="px-3 py-2">{who ?? "—"}</td>
                      <td className="px-3 py-2">{e?.staff_member_name ?? ""}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[l.note, e ? attendanceLabel(e) : null].filter(Boolean).join(" · ")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(l.adds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="border-t border-border px-3 py-2 text-sm font-medium">
            {n(new Set(shownLines.map((l) => l.id)).size)} entr{new Set(shownLines.map((l) => l.id)).size === 1 ? "y" : "ies"}
            {!isPerson && def && "unit" in def && (def.unit === "people" || def.unit === "facilities" || def.unit === "organizations")
              ? ` · ${n(distinctPeople)} different`
              : ` · adds up to ${n(totalAdds)}`}
          </p>
        </div>
      )}
    </div>
  );
}
