/**
 * "It saved" confirmations.
 *
 * After a create/edit form saves, the server action redirects to the
 * record's page. That redirect alone can be easy to miss on a phone --
 * the page just changes. So the redirect also carries a small
 * `?saved=<kind>` marker, which <SaveToast> (in the app layout) turns
 * into a clear "Visit logged" / "Resident saved" confirmation and then
 * removes from the address bar.
 *
 * Plain module (no "use server") so both server actions and the client
 * toast can import it.
 */
export const SAVED_MESSAGES = {
  "resident-added": "Resident added",
  "resident-saved": "Resident details saved",
  "resident-moved": "Resident moved to the new facility",
  "facility-added": "Facility added",
  "facility-saved": "Facility details saved",
  "visit-logged": "Visit logged",
  "interaction-logged": "Interaction logged",
  "interaction-saved": "Interaction updated",
  "task-added": "Follow-up task added",
  "task-saved": "Task saved",
  "contact-added": "Contact added",
  "contact-saved": "Contact saved",
  "family-contact-added": "Family contact added",
  "family-contact-saved": "Family contact updated",
  "facility-contact-added": "Facility contact added",
  "facility-contact-linked": "Contact linked to this facility",
  "organization-added": "Organization added",
  "organization-saved": "Organization saved",
  "organization-contact-linked": "Contact linked to this organization",
} as const;

export type SavedKind = keyof typeof SAVED_MESSAGES;

/** Appends the saved marker to a redirect path (which may already have
 * its own query string). `recordId` is optional extra context -- e.g.
 * the new interaction's id, so the toast can offer "Add a follow-up". */
export function withSaved(path: string, kind: SavedKind, recordId?: string): string {
  const [base, hash] = path.split("#");
  const params = new URLSearchParams();
  params.set("saved", kind);
  if (recordId) params.set("savedId", recordId);
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${params.toString()}${hash ? `#${hash}` : ""}`;
}
