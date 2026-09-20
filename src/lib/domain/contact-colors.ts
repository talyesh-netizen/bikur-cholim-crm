import type { ContactType } from "@/lib/domain/contact";

/**
 * Stable color per contact type, so the different kinds of people (family,
 * volunteers, shul contacts, facility staff, etc.) are visually scannable
 * in a list at a glance, not just readable as text.
 */
const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  family_member: "#d6336c",
  volunteer: "#1baf7a",
  rabbi: "#5b5fc7",
  synagogue_contact: "#2a78d6",
  facility_staff: "#0f8b8d",
  community_partner: "#eb6834",
  other_referral_source: "#898781",
};

const FALLBACK_COLOR = "#898781";

export function contactTypeColor(contactType: string | null | undefined): string {
  if (!contactType) return FALLBACK_COLOR;
  return CONTACT_TYPE_COLORS[contactType as ContactType] ?? FALLBACK_COLOR;
}
