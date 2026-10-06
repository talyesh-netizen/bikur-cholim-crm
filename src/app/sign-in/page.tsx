"use client";

import { BrandLogo } from "@/components/brand-mark";
import { useActionState, useState } from "react";
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
import { requestPasswordReset, signIn, type SignInState } from "@/lib/actions/auth";
import { APP_NAME } from "@/lib/config";
import { Eye, EyeOff } from "lucide-react";

const initialState: SignInState = { error: null };

export default function SignInPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error" | "missing_email">("idle");

  async function handleForgotPassword() {
    if (!email) {
      setResetState("missing_email");
      return;
    }
    setResetState("sending");
    const { ok } = await requestPasswordReset(email);
    // Same message either way -- confirming or denying that an email
    // exists in the system is its own small privacy leak.
    setResetState(ok ? "sent" : "error");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-6">
      <BrandLogo className="mb-8 w-56" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <CardDescription>Sign in with your staff account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@bikurcholimcleveland.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setResetState("idle");
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetState === "sending"}
                className="self-start text-xs text-muted-foreground underline hover:text-foreground"
              >
                Forgot password?
              </button>
              {resetState === "sending" ? (
                <p className="text-xs text-muted-foreground">Sending reset link…</p>
              ) : null}
              {resetState === "sent" ? (
                <p className="text-xs text-success">
                  If that email has an account, a reset link is on its way.
                </p>
              ) : null}
              {resetState === "missing_email" ? (
                <p className="text-xs text-destructive">
                  Enter your email above first, then tap &quot;Forgot password?&quot; again.
                </p>
              ) : null}
              {resetState === "error" ? (
                <p className="text-xs text-destructive">
                  Something went wrong sending the reset link. Please try again in a moment.
                </p>
              ) : null}
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={isPending} className="mt-2">
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">
        Trouble signing in? Contact an administrator to check that your
        account is set up and active.
      </p>
    </main>
  );
}
