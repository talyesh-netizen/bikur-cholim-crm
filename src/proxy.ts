import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { normalizeSiteUrl } from "@/lib/site-url";

// Runs on the server in front of every page request — this is the one
// place that enforces "you must be signed in to see anything." Called
// "Proxy" as of Next.js 16 (previously "Middleware"); see
// src/lib/supabase/middleware.ts for the actual sign-in check.
//
// IMPORTANT: because this project uses the src/ directory layout, this
// file must live at src/proxy.ts, NOT at the project root — Next.js
// only looks one level above src/app for it. A copy at the project root
// is silently ignored (confirmed by testing).
export async function proxy(request: NextRequest) {
  const canonical = canonicalDomainRedirect(request);
  if (canonical) return canonical;
  return await updateSession(request);
}

/**
 * Sends anyone who opens the production app on a secondary address
 * (e.g. the *.vercel.app one) over to the one official domain, so staff
 * don't end up signed in on two different addresses or install the app
 * from the wrong one.
 *
 * Opt-in: only active when REDIRECT_TO_CANONICAL_DOMAIN=true is set in
 * Vercel's Production environment, AND NEXT_PUBLIC_SITE_URL is set. Turn
 * it on only after the custom domain is working -- otherwise it would
 * redirect everyone to an address that doesn't load yet. /api routes
 * (the daily reminder cron) are never redirected.
 */
function canonicalDomainRedirect(request: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV !== "production") return null;
  if (process.env.REDIRECT_TO_CANONICAL_DOMAIN !== "true") return null;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return null;
  if (request.nextUrl.pathname.startsWith("/api/")) return null;

  let target: URL;
  try {
    target = new URL(normalizeSiteUrl(configured));
  } catch {
    return null;
  }

  const host = request.headers.get("host");
  if (!host || host === target.host) return null;

  const url = request.nextUrl.clone();
  url.protocol = target.protocol;
  url.host = target.host;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Static files are skipped entirely -- including the app manifest and
  // icons, which phones fetch *without* a signed-in session when
  // installing the app to the home screen. If those were redirected to
  // /sign-in, "Add to Home Screen" would silently get a blank icon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
