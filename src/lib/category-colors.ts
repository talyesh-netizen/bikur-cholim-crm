/**
 * Stripe colors for list tiles. Uses the --cat-1..8 palette in
 * globals.css (fixed order, checked for color-blind separation). Every
 * stripe sits next to a text label saying the same thing, so color is
 * never the only cue.
 */

const cat = (n: number) => `var(--cat-${n})`;
export const NO_CATEGORY_COLOR = "var(--cat-none)";

/** Facility areas: the numbered zones get one color each, in zone
 * order (two areas share "Zone 7", so ties go by the admin's display
 * order). Outlying areas without a zone number, and any zone past the
 * 8 colors, share the neutral stripe -- the area name still shows. */
export function clusterColorMap(
  clusters: { id: string; name: string; display_order: number | null }[]
): Map<string, string> {
  const zoned = clusters
    .map((c) => ({ ...c, zone: Number(/\(Zone (\d+)\)/i.exec(c.name)?.[1] ?? NaN) }))
    .filter((c) => !Number.isNaN(c.zone))
    .sort((a, b) => a.zone - b.zone || (a.display_order ?? 0) - (b.display_order ?? 0));
  const map = new Map<string, string>();
  for (const c of clusters) map.set(c.id, NO_CATEGORY_COLOR);
  zoned.slice(0, 8).forEach((c, i) => map.set(c.id, cat(i + 1)));
  return map;
}

/** Who a task is about, for its tile. */
export type TaskWho = "resident" | "family" | "facility" | "partner" | "shul" | "volunteer" | "none";

export const TASK_WHO: Record<TaskWho, { label: string; color: string }> = {
  resident: { label: "Resident", color: cat(1) },
  facility: { label: "Facility & staff", color: cat(3) },
  family: { label: "Family", color: cat(5) },
  shul: { label: "Shul & rabbi", color: cat(4) },
  partner: { label: "Community partner", color: cat(7) },
  volunteer: { label: "Volunteer", color: cat(2) },
  none: { label: "General", color: NO_CATEGORY_COLOR },
};

export function taskWho(task: { contact_type?: string | null; resident_id: string | null; facility_id: string | null }): TaskWho {
  switch (task.contact_type) {
    case "family_member":
      return "family";
    case "facility_staff":
      return "facility";
    case "rabbi":
    case "synagogue_contact":
      return "shul";
    case "volunteer":
      return "volunteer";
    case "community_partner":
    case "other_referral_source":
      return "partner";
  }
  if (task.resident_id) return "resident";
  if (task.facility_id) return "facility";
  return "none";
}
