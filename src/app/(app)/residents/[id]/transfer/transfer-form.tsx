"use client";

import { FacilityPicker } from "@/components/facility-picker";
import { FormActions, FormError } from "@/components/form-actions";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TransferFormState } from "@/lib/actions/transfer-resident";
import { Undo2 } from "lucide-react";

type Action = (state: TransferFormState, formData: FormData) => Promise<TransferFormState>;

export function TransferForm({
  action,
  facilities,
  currentFacilityName,
  previousFacility,
}: {
  action: Action;
  facilities: { id: string; name: string }[];
  currentFacilityName: string | null;
  previousFacility?: { id: string; name: string } | null;
}) {
  const [state, formAction, isPending] = useActionState<TransferFormState, FormData>(action, {
    error: null,
  });
  const [facilityId, setFacilityId] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      {previousFacility ? (
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          onClick={() => setFacilityId(previousFacility.id)}
        >
          <Undo2 className="size-4" />
          Move back to {previousFacility.name}
        </Button>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new_facility_id">
          {currentFacilityName ? (
            <>
              Currently at <span className="font-medium">{currentFacilityName}</span>. Move to:
            </>
          ) : (
            <>
              <span className="font-medium">Current location unknown.</span> Move to:
            </>
          )}
        </Label>
        <FacilityPicker
          id="new_facility_id"
          name="new_facility_id"
          facilities={facilities}
          value={facilityId}
          onChange={setFacilityId}
          placeholder="Type the new facility's name…"
        />
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

      <FormActions
        isPending={isPending} disabled={!facilityId}
        submitLabel={"Confirm move"}
        savingLabel={"Moving…"}
        hasUnsavedError={!!state.error}
      />
    </form>
  );
}
