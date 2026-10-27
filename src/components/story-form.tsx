"use client";

import { useActionState } from "react";
import { FacilityPicker } from "@/components/facility-picker";
import { SearchPicker } from "@/components/search-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StoryFormState } from "@/lib/actions/stories";

type Action = (state: StoryFormState, formData: FormData) => Promise<StoryFormState>;

/** A story: the text, and -- only if wanted -- a resident and/or a
 * facility. Nothing is required but the story (Oct 27, 2026). */
export function StoryForm({
  action,
  residents,
  facilities,
  initial,
  submitLabel = "Save story",
}: {
  action: Action;
  residents: { id: string; name: string; detail?: string | null }[];
  facilities: { id: string; name: string }[];
  initial?: { story: string; resident_id: string; facility_id: string };
  submitLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState<StoryFormState, FormData>(action, { error: null });
  const values = state.values ?? initial ?? { story: "", resident_id: "", facility_id: "" };

  return (
    <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story">Story</Label>
        <Textarea id="story" name="story" rows={8} defaultValue={values.story} required autoFocus={!initial} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resident_id">Resident (optional)</Label>
          <SearchPicker
            id="resident_id"
            name="resident_id"
            defaultValue={values.resident_id}
            options={residents.map((r) => ({ id: r.id, label: r.name, detail: r.detail }))}
            emptyLabel="No resident"
            placeholder="Type a resident's name…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="facility_id">Facility (optional)</Label>
          <FacilityPicker id="facility_id" name="facility_id" facilities={facilities} defaultValue={values.facility_id} emptyLabel="No facility" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">You can link it to a resident or facility now, later, or not at all.</p>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
