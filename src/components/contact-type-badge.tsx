import { contactTypeColor } from "@/lib/domain/contact-colors";
import { ColorBadge } from "@/components/color-badge";

/** A contact's type (family, volunteer, shul contact, facility staff,
 * etc.) -- mirrors ClusterBadge so the different kinds of people are as
 * scannable as facility clusters are. */
export function ContactTypeBadge({
  contactType,
  label,
}: {
  contactType: string | null | undefined;
  label: string;
}) {
  return <ColorBadge color={contactTypeColor(contactType)} label={label} />;
}
