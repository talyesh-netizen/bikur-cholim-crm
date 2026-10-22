import { listResidents } from "@/lib/queries/residents";
import { residentName } from "@/lib/domain/resident-name";

/** Residents for the log form's Resident box, with where each lives so
 * two people with the same name can be told apart. `include` adds
 * someone the usual list leaves out (e.g. the resident already on an
 * entry being edited, who has since been discharged). */
export async function residentOptions(include?: string | null) {
  const [usual, extra] = await Promise.all([
    listResidents(),
    include ? listResidents({ showAllStatuses: true }) : Promise.resolve([]),
  ]);
  const rows = [...usual, ...extra.filter((r) => r.id === include && !usual.some((u) => u.id === r.id))];
  return rows.map((r) => ({
    id: r.id,
    name: residentName(r),
    facility_id: r.current_facility_id,
    detail:
      [r.current_facility_name, r.room_number]
        .filter(Boolean)
        .join(" · ") || null,
  }));
}
