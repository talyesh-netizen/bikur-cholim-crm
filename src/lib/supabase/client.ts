import { createBrowserClient } from "@supabase/ssr";

/**
 * The Supabase client used in the browser (Client Components). Safe to
 * call from anywhere on the client — it does not make a network request
 * on its own, only when you actually call something like
 * `.auth.signInWithPassword(...)`.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
