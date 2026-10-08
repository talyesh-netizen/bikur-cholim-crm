import type { OrganizationType } from "@/lib/domain/organization";

/**
 * Stable color per organization type (synagogue, school, outreach center,
 * community partner, other), used when a contact's primary profile is set to
 * "their shul/school/partner" -- same idea as contactTypeColor and
 * clusterColor.
 */
const ORGANIZATION_TYPE_COLORS: Record<OrganizationType, string> = {
  synagogue: "#5b5fc7",
  school: "#eda100",
  jewish_organization: "#2e9d62",
  healthcare_group: "#2a78d6",
  outreach_center: "#2e9d62",
  community_partner: "#eb6834",
  other: "#898781",
};

const FALLBACK_COLOR = "#898781";

export function organizationTypeColor(organizationType: string | null | undefined): string {
  if (!organizationType) return FALLBACK_COLOR;
  return ORGANIZATION_TYPE_COLORS[organizationType as OrganizationType] ?? FALLBACK_COLOR;
}
