"use client";

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

    supabase.auth.getSession().then(({ data }) => {
      if (isPasswordRecovery) return;
      router.replace(data.session ? "/dashboard" : "/sign-in");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
      setError("Something went wrong. Please request a new reset link and try again.");
      return;
    }

    router.replace("/dashboard");
  }

  if (!showResetForm) {
    // Deciding where to send you — this is intentionally brief.
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
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
                required
              />
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
