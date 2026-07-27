"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransferFormState } from "@/lib/actions/transfer-resident";

type Action = (state: TransferFormState, formData: FormData) => Promise<TransferFormState>;

export function TransferForm({
  action,
  facilities,
  currentFacilityName,
}: {
  action: Action;
  facilities: { id: string; name: string }[];
  currentFacilityName: string;
}) {
  const [state, formAction, isPending] = useActionState<TransferFormState, FormData>(action, {
    error: null,
  });
  const [facilityId, setFacilityId] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new_facility_id">
          Currently at <span className="font-medium">{currentFacilityName}</span>. Move to:
        </Label>
        <input type="hidden" name="new_facility_id" value={facilityId} readOnly />
        <Select value={facilityId} onValueChange={setFacilityId}>
          <SelectTrigger id="new_facility_id">
            <SelectValue placeholder="Choose the new facility…" />
          </SelectTrigger>
          <SelectContent>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Reason for the move (optional)</Label>
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          placeholder="e.g., Discharged from hospital, family requested closer location…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Additional notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <p className="text-xs text-muted-foreground">
        This resident&apos;s full visit and care history stays with them —
        moving facilities never erases anything, and the move itself will
        appear in their timeline.
      </p>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !facilityId}>
          {isPending ? "Moving…" : "Confirm move"}
        </Button>
      </div>
    </form>
  );
}
