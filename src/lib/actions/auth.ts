"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPasswordSetupEmail } from "@/lib/supabase/recovery";
import { passwordProblem } from "@/lib/password-rules";

export type SignInState = { error: string | null };

export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return { error: "Please enter both your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Logged server-side only (visible in Vercel's function logs), never
    // shown to the person signing in — the message below stays generic
    // on purpose so we don't hint at which part was wrong.
    console.error("Sign-in failed:", error.status, error.code, error.message);
    return { error: "That email and password didn't match. Please try again." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/** "Forgot password?" on the sign-in page. Runs on the server so the
 * emailed link works on any device -- see lib/supabase/recovery.ts. */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false };
  const { error } = await sendPasswordSetupEmail(trimmed);
  return { ok: !error };
}

export type ChangePasswordState = { error: string | null; done: boolean };

/** Settings -> Change password. Asks for the current password first, so
 * someone using an unattended signed-in phone can't lock the owner out. */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const current = (formData.get("current") as string | null) ?? "";
  const next = (formData.get("password") as string | null) ?? "";
  const confirm = (formData.get("confirm") as string | null) ?? "";

  if (!current || !next) return { error: "Please fill in your current and new password.", done: false };
  if (next !== confirm) return { error: "The two new passwords don't match.", done: false };
  const problem = passwordProblem(next);
  if (problem) return { error: problem, done: false };
  if (next === current) return { error: "The new password is the same as the current one.", done: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Your session expired. Please sign in again.", done: false };

  const { error: wrongCurrent } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (wrongCurrent) return { error: "Your current password isn't right. Please try again.", done: false };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    console.error("Password change failed:", error.status, error.code, error.message);
    return {
      error: error.code === "weak_password" ? "That password isn't strong enough." : "Couldn't change the password just now. Please try again.",
      done: false,
    };
  }
  return { error: null, done: true };
}
