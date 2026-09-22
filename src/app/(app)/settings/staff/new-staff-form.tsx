"use client";

import { useActionState, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStaffAccount, type StaffFormState } from "@/lib/actions/staff";
import { Copy } from "lucide-react";
import { capitalizeOnBlur } from "@/lib/format-text";

export function NewStaffForm({ facilities }: { facilities: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [scope, setScope] = useState<"all" | "restricted">("all");
  const [state, formAction, isPending] = useActionState<StaffFormState, FormData>(
    async (prevState, formData) => {
      const result = await createStaffAccount(prevState, formData);
      if (!result.error) {
        formRef.current?.reset();
        setScope("all");
      }
      return result;
    },
    { error: null }
  );
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-4">
      {state.temporaryPassword ? (
        <TemporaryPasswordBanner password={state.temporaryPassword} />
      ) : null}

      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" onBlur={capitalizeOnBlur} required />
            {fieldErrors.full_name ? (
              <p className="text-xs text-destructive">{fieldErrors.full_name}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
            {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <input type="hidden" name="role" value={role} readOnly />
            <Select value={role} onValueChange={(v) => setRole(v as "staff" | "admin")}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="facility_access_scope">Facility access</Label>
            <input type="hidden" name="facility_access_scope" id="scope-value" value={scope} readOnly />
            <Select value={scope} onValueChange={(v) => setScope(v as "all" | "restricted")}>
              <SelectTrigger id="facility_access_scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                <SelectItem value="restricted">Only selected facilities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {scope === "restricted" ? (
          <div className="flex flex-col gap-1.5">
            <Label>Facilities this person can see</Label>
            <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
              {facilities.map((facility) => (
                <label key={facility.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="facility_ids" value={facility.id} className="accent-primary" />
                  {facility.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TemporaryPasswordBanner({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
      <p className="font-medium text-success">Account created.</p>
      <p className="text-muted-foreground">
        Share this temporary password with them securely (not email) so they can sign in. It won&apos;t be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-card px-2 py-1.5 font-mono text-sm">{password}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
