"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type ChangePasswordState } from "@/lib/actions/auth";
import { PASSWORD_RULES_TEXT } from "@/lib/password-rules";

const initial: ChangePasswordState = { error: null, done: false };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);

  if (state.done) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 pt-6 text-sm">
          <CheckCircle2 className="size-5 text-success" />
          Your password is changed. Use the new one next time you sign in.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md">
      <CardContent className="pt-6">
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-describedby="password-rules"
              required
            />
            <p id="password-rules" className="text-xs text-muted-foreground">
              {PASSWORD_RULES_TEXT}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">New password again</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
