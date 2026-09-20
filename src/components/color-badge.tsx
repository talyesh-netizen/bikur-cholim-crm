/** Bolder, filled color chip for an arbitrary color+label -- same look
 * as ContactTypeBadge/ClusterBadge, but for a color resolved at render
 * time (e.g. a contact's primary-profile color, which might follow
 * their type, their facility, or their organization). */
export function ColorBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
