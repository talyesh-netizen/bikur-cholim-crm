import { clusterColor } from "@/lib/domain/cluster-colors";
import { StatusBadge } from "@/components/status-badge";

/** A facility's geographic cluster (or a facility name tinted by its
 * cluster) -- a calm neutral chip with a small color dot, so clusters
 * stay scannable at a glance without every list turning into a rainbow.
 * The name is always shown as text; the color is only a hint. */
export function ClusterBadge({
  clusterId,
  name,
  className,
}: {
  clusterId: string | null | undefined;
  name: string;
  className?: string;
}) {
  return (
    <StatusBadge tone="neutral" dot={clusterColor(clusterId)} className={className}>
      {name}
    </StatusBadge>
  );
}
