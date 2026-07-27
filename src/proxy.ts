import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
