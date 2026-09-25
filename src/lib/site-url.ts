/**
 * The one canonical web address for the app (e.g.
 * "https://crm.bikurcholimcleveland.org"), used anywhere an absolute
 * link is needed: password-reset emails, task-reminder emails, the
 * installable-app manifest, and page metadata.
 *
 * Set NEXT_PUBLIC_SITE_URL in Vercel (Production environment) to the
 * real domain. Without it, this falls back to Vercel's own production
 * URL, then the current deployment's URL, then localhost for local
 * development -- so nothing breaks before the domain is set up, but
 * links in emails would point at a *.vercel.app address.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalizeSiteUrl(explicit);

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProduction) return normalizeSiteUrl(vercelProduction);

  const vercelDeployment = process.env.VERCEL_URL;
  if (vercelDeployment) return normalizeSiteUrl(vercelDeployment);

  return "http://localhost:3000";
}

/** In the browser, only NEXT_PUBLIC_ variables exist -- so browser code
 * uses the configured canonical URL if there is one, otherwise the
 * address the page is actually open on. */
export function getBrowserSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return explicit ? normalizeSiteUrl(explicit) : window.location.origin;
}

export function normalizeSiteUrl(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}
