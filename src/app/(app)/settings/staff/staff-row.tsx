"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateStaffAccess,
  sendPasswordResetEmail,
  type StaffFormState,
  type ResetEmailState,
} from "@/lib/actions/staff";
import type { StaffAccount } from "@/lib/queries/profiles";
import { KeyRound } from "lucide-react";

export function StaffRow({
  account,
  facilities,
  isSelf,
}: {
  account: StaffAccount;
  facilities: { id: string; name: string }[];
  isSelf: boolean;
}) {
  const [role, setRole] = useState(account.role);
  const [active, setActive] = useState(account.active);
  const [scope, setScope] = useState(account.facility_access_scope);

  const action = updateStaffAccess.bind(null, account.id);
  const [state, formAction, isPending] = useActionState<StaffFormState, FormData>(action, {
    error: null,
  });

  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium leading-tight">
            {account.full_name}
            {isSelf ? <span className="text-muted-foreground"> (you)</span> : ""}
          </p>
          <p className="text-sm text-muted-foreground">{account.email}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!account.active ? <Badge variant="outline">Inactive</Badge> : null}
          <Badge variant="secondary" className="capitalize">
            {account.role}
          </Badge>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Role</span>
            <input type="hidden" name="role" value={role} readOnly />
            <Select value={role} onValueChange={(v) => setRole(v as "staff" | "admin")} disabled={isSelf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Status</span>
            <input type="hidden" name="active" value={String(active)} readOnly />
            <Select value={String(active)} onValueChange={(v) => setActive(v === "true")} disabled={isSelf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Facility access</span>
            <input type="hidden" name="facility_access_scope" value={scope} readOnly />
            <Select value={scope} onValueChange={(v) => setScope(v as "all" | "restricted")}>
              <SelectTrigger>
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
          <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
            {facilities.map((facility) => (
              <label key={facility.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="facility_ids"
                  value={facility.id}
                  defaultChecked={account.facility_ids.includes(facility.id)}
                  className="accent-primary"
                />
                {facility.name}
              </label>
            ))}
          </div>
        ) : null}

        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

        <div className="flex items-center justify-between gap-2">
          <ResetPasswordButton email={account.email} />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordButton({ email }: { email: string }) {
  const action = sendPasswordResetEmail.bind(null, email);
  const [state, formAction, isPending] = useActionState<ResetEmailState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        <KeyRound className="size-4" />
        {isPending ? "Sending…" : state.sent ? "Reset email sent" : "Send password reset"}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
