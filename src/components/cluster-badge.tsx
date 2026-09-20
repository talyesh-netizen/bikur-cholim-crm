import { clusterColor } from "@/lib/domain/cluster-colors";

/** Bolder, filled color chip for a facility's geographic cluster — used
 * anywhere a facility is listed so clusters are visually scannable at a
 * glance, not just readable as text. */
export function ClusterBadge({
  clusterId,
  name,
}: {
  clusterId: string | null | undefined;
  name: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: clusterColor(clusterId) }}
    >
      {name}
    </span>
  );
}
