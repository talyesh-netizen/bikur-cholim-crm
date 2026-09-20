import { contactTypeColor } from "@/lib/domain/contact-colors";

/** Bolder, filled color chip for a contact's type (family, volunteer,
 * shul contact, facility staff, etc.) — mirrors ClusterBadge so the
 * different kinds of people are as scannable as facility clusters are. */
export function ContactTypeBadge({
  contactType,
  label,
}: {
  contactType: string | null | undefined;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: contactTypeColor(contactType) }}
    >
      {label}
    </span>
  );
}
