import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths anyone can reach without being signed in.
const PUBLIC_PATHS = ["/sign-in"];

/**
 * Runs on every request (see middleware.ts at the project root).
 * Refreshes the signed-in session and, importantly, is the one place
 * that enforces "you must be signed in to see anything" — see
 * PRIVACY_AND_SECURITY.md: this is the app-level half of that
 * protection, with the database's own row-level security rules as the
 * second, independent layer.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // If the auth service is unreachable (e.g., no real Supabase project
  // configured yet), treat that the same as "not signed in" rather than
  // crashing the whole app — fail closed, not open.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;
  // The root path is a special case: it's where Supabase sends people
  // after they click a "reset your password" or magic-link email, with
  // the actual proof-of-identity token attached as a URL fragment
  // (the part after "#"). Browsers never send that fragment to the
  // server, so this proxy has no way to see it here — only the page's
  // own client-side code can read it. That means "/" has to render even
  // for a signed-out visitor; the page itself (src/app/page.tsx) checks
  // for that token and redirects to /sign-in if there isn't one.
  const isPublicPath =
    pathname === "/" || PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
