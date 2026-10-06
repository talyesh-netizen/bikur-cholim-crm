import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Sends the "set your password" email. Server-only.
 *
 * Why not just call resetPasswordForEmail on the app's normal clients:
 * those use Supabase's PKCE flow, where the link in the email only works
 * in the same browser that asked for it (a secret is kept in that
 * browser's cookies). So a link an admin sent from the staff page never
 * worked for the staff member, and a "Forgot password?" asked on a
 * computer but opened on a phone didn't either. This one-off client uses
 * the older "implicit" flow instead: the link carries everything needed
 * in its "#..." part, so it works on any device -- see src/app/page.tsx,
 * which reads it and shows the "Set a new password" form.
 */
export async function sendPasswordSetupEmail(email: string): Promise<{ error: string | null }> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Always the canonical domain (see lib/site-url.ts). It must be listed
    // under Authentication > URL Configuration > Redirect URLs in
    // Supabase; if it isn't, Supabase falls back to the project's Site URL.
    redirectTo: `${getSiteUrl()}/`,
  });
  if (error) console.error("Password email failed:", error.status, error.code, error.message);
  return { error: error ? error.message : null };
}
