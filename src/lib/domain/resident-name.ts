/** A resident's display name. First or last name may be unknown (one of
 * the two is always present), so never print "null" or invent a name. */
export function residentName(r: {
  first_name: string | null;
  last_name: string | null;
  preferred_name?: string | null;
}) {
  return [r.preferred_name || r.first_name, r.last_name].filter(Boolean).join(" ") || "Unnamed resident";
}
