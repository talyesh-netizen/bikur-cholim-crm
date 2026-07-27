import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * The Supabase client used in Server Components, Server Actions, and
 * Route Handlers. Reads/writes the signed-in session via cookies, so it
 * always reflects who is actually signed in for the current request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies
            // directly (e.g., during rendering rather than in a Server
            // Action). Safe to ignore because the middleware
            // (src/lib/supabase/middleware.ts) refreshes the session on
            // every request anyway.
          }
        },
      },
    }
  );
}
