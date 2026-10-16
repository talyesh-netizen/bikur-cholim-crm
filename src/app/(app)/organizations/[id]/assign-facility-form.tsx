"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FacilityPicker } from "@/components/facility-picker";
import type { MatchableFacility } from "@/lib/facility-match";
import type { GroupAssignState } from "@/lib/actions/facilities";

type Action = (state: GroupAssignState, formData: FormData) => Promise<GroupAssignState>;

/** "Add a facility to this group": type a facility's name, tap Add. A
 * facility already in another group says so and asks first. */
export function AssignFacilityForm({
  action,
  facilities,
  groupName,
}: {
  action: Action;
  facilities: MatchableFacility[];
  groupName: string;
}) {
  const [state, formAction, isPending] = useActionState<GroupAssignState, FormData>(action, { error: null });
  const [facilityId, setFacilityId] = useState("");
  const chosen = facilities.find((f) => f.id === facilityId);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const current = chosen?.parent_healthcare_group?.trim();
        if (current && !window.confirm(`${chosen?.name} is listed under ${current}. Move it to ${groupName}?`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <FacilityPicker
        name="facility_id"
        facilities={facilities}
        value={facilityId}
        onChange={setFacilityId}
        placeholder="Type a facility name to add…"
        className="flex-1"
      />
      <Button type="submit" disabled={!facilityId || isPending} className="h-11">
        <Plus className="size-4" />
        {isPending ? "Adding…" : "Add to group"}
      </Button>
      {state.error ? <p role="alert" className="text-sm font-medium text-destructive sm:basis-full">{state.error}</p> : null}
    </form>
  );
}
