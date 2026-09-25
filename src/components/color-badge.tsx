import { StatusBadge } from "@/components/status-badge";

/** A label with a small color dot, for a color resolved at render time
 * (e.g. a contact's primary-profile color, which might follow their
 * type, their facility, or their organization). Same shape as every
 * other badge -- see status-badge.tsx. */
export function ColorBadge({ color, label }: { color: string; label: string }) {
  return (
    <StatusBadge tone="neutral" dot={color}>
      {label}
    </StatusBadge>
  );
}
