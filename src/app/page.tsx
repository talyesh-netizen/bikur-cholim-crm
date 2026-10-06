"use client";

import { BrandLogo } from "@/components/brand-mark";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordProblem, PASSWORD_RULES_TEXT } from "@/lib/password-rules";

/**
 * The root path does two different jobs depending on how someone
 * arrives here:
 *
 * 1. Normally, it's just a landing spot that sends people to /dashboard
 *    (if signed in) or /sign-in (if not) — same as before.
 * 2. It's also where Supabase sends someone after they click a
 *    "reset your password" email link. That link carries a one-time
 *    token in the URL fragment (the part after "#"), which browsers
 *    never send to a server — only this page's own client-side code can
 *    see it. When that happens, Supabase fires a "PASSWORD_RECOVERY"
 *    event and we show a simple "choose a new password" form instead of
 *    redirecting away.
 *
 * See src/lib/supabase/middleware.ts for why "/" specifically has to be
 * reachable without already being signed in.
 */
export default function Home() {
  const router = useRouter();
  const [showResetForm, setShowResetForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isPasswordRecovery = false;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        isPasswordRecovery = true;
        setShowResetForm(true);
      }
    });

    // Password emails (lib/supabase/recovery.ts) put the one-time sign-in
    // in the "#..." part of the link so it works on any device. This
    // app's client only reads links made for the same browser, so take
    // the session from the link ourselves, then ask for a new password.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (hash.get("type") === "recovery" && accessToken && refreshToken) {
      isPasswordRecovery = true;
      window.history.replaceState(null, "", window.location.pathname);
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => (error ? router.replace("/sign-in") : setShowResetForm(true)));
    }

    supabase.auth.getSession().then(({ data }) => {
      if (isPasswordRecovery) return;
      router.replace(data.session ? "/dashboard" : "/sign-in");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setIsPending(false);

    if (error) {
      // A password Supabase still rejects (its rules may have been
      // tightened since password-rules.ts was written) isn't a broken
      // link -- say so, rather than sending them back for a new email.
      setError(
        error.code === "weak_password"
          ? `That password isn't strong enough. ${PASSWORD_RULES_TEXT}`
          : "Something went wrong. Please request a new reset link and try again."
      );
      return;
    }

    router.replace("/dashboard");
  }

  if (!showResetForm) {
    // Deciding where to send you — this is intentionally brief.
    return null;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-6">
      <BrandLogo className="mb-8 w-56" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>Choose a password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-describedby="password-rules"
                required
              />
              <p id="password-rules" className="text-xs text-muted-foreground">
                {PASSWORD_RULES_TEXT}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
