import { contactTypeColor } from "@/lib/domain/contact-colors";
import { clusterColor } from "@/lib/domain/cluster-colors";
import { organizationTypeColor } from "@/lib/domain/organization-colors";
import { labelFor, CONTACT_TYPES, type PrimaryProfileKind } from "@/lib/domain/contact";

type PrimaryProfileContact = { contact_type: string; primary_profile_kind: PrimaryProfileKind };
type PrimaryProfileFacility = { name: string; clusterId: string | null | undefined } | null | undefined;
type PrimaryProfileOrganization = { name: string; organizationType: string | null | undefined } | null | undefined;

/** A contact's main color/identity is normally their contact_type, but
 * staff can set it to follow their primary facility or organization
 * instead (see primary_profile_kind). Falls back to contact_type
 * whenever the chosen kind doesn't have a primary link to follow --
 * e.g. the link was later removed -- so this never breaks. */
export function primaryProfileColor(
  contact: PrimaryProfileContact,
  facility: PrimaryProfileFacility,
  organization: PrimaryProfileOrganization
): string {
  if (contact.primary_profile_kind === "facility" && facility) {
    return clusterColor(facility.clusterId);
  }
  if (contact.primary_profile_kind === "organization" && organization) {
    return organizationTypeColor(organization.organizationType);
  }
  return contactTypeColor(contact.contact_type);
}

/** The label to show alongside primaryProfileColor -- the facility or
 * organization name when following one of those, otherwise the
 * contact type label. */
export function primaryProfileLabel(
  contact: PrimaryProfileContact,
  facility: PrimaryProfileFacility,
  organization: PrimaryProfileOrganization
): string {
  if (contact.primary_profile_kind === "facility" && facility) {
    return facility.name;
  }
  if (contact.primary_profile_kind === "organization" && organization) {
    return organization.name;
  }
  return labelFor(CONTACT_TYPES, contact.contact_type);
}
