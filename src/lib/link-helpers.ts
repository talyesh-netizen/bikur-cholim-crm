/** Builds real, clickable links out of free-text contact fields imported
 * from the tracking sheet — guards against turning stray notes (e.g.
 * "Don't Have it", "Lives in Vermont") into bogus tel:/mailto: links. */

export function telHref(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  const digitCount = digits.replace(/\D/g, "").length;
  if (digitCount < 7) return undefined;
  return `tel:${digits}`;
}

export function mailtoHref(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  return /^\S+@\S+\.\S+$/.test(email) ? `mailto:${email}` : undefined;
}

export function websiteHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function mapsHref(address: string | null | undefined): string | undefined {
  if (!address) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
