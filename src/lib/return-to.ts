/**
 * A page inside the CRM to come back to after finishing something
 * elsewhere (e.g. "Add a new contact" from a "Link a contact" page).
 * Only same-site paths are accepted, so a link can never send someone
 * off to another website.
 */
export function safeReturnTo(value: string | string[] | null | undefined): string | undefined {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return undefined;
  return path;
}

/** `path` with `?key=value` added (keeping any query it already has). */
export function withParam(path: string, key: string, value: string): string {
  const [base, hash] = path.split("#");
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}
