"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
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
  deleteStaffAccount,
  type StaffFormState,
  type ResetEmailState,
  type DeleteStaffState,
} from "@/lib/actions/staff";
import type { StaffAccount } from "@/lib/queries/profiles";
import { KeyRound, Trash2 } from "lucide-react";

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

  // Submitted by hand rather than via <form action>: React resets a form
  // after its action runs, and Radix Select answers that reset by
  // snapping back to the value it first rendered with -- so a just-saved
  // "Active" would flip back to "Inactive" on screen, and the next Save
  // would quietly deactivate the account again.
  const formId = `staff-row-${account.id}`;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

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

      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Role</span>
            <input type="hidden" name="role" value={role} readOnly />
            <Select value={role} onValueChange={(v) => setRole(v as "staff" | "admin" | "intern")} disabled={isSelf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="intern">Intern (can&apos;t see private notes)</SelectItem>
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
        {state.saved ? <p className="text-xs text-success">Saved.</p> : null}
      </form>

      {/* Outside the form above: the reset/delete buttons are forms of
          their own, and forms can't be nested. Save reaches back into it
          through the form attribute. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-start gap-2">
          <ResetPasswordButton email={account.email} />
          {isSelf ? null : <DeleteAccountButton profileId={account.id} name={account.full_name} />}
        </div>
        <Button type="submit" form={formId} size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
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

function DeleteAccountButton({ profileId, name }: { profileId: string; name: string }) {
  const action = deleteStaffAccount.bind(null, profileId);
  const [state, formAction, isPending] = useActionState<DeleteStaffState, FormData>(action, {
    error: null,
  });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Permanently delete ${name}'s account? This can't be undone.`)) e.preventDefault();
      }}
    >
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="text-destructive">
        <Trash2 className="size-4" />
        {isPending ? "Deleting…" : "Delete account"}
      </Button>
      {state.error ? <p className="mt-1 max-w-xs text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
