"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchPicker, type PickerOption } from "@/components/search-picker";
import type { MergeContactState } from "@/lib/actions/contacts";

type Action = (state: MergeContactState, formData: FormData) => Promise<MergeContactState>;

/** Admin only: "this person is already in the CRM under another
 * record". Asks which record to keep, then confirms before saving. */
export function MergeContactForm({ action, options, name }: { action: Action; options: PickerOption[]; name: string }) {
  const [state, formAction, isPending] = useActionState<MergeContactState, FormData>(action, { error: null });
  const [keepId, setKeepId] = useState("");
  const keep = options.find((o) => o.id === keepId);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Mark "${name}" as a duplicate of "${keep?.label}"? It will be hidden from searches and lists. Its visits and links are kept, and this can be undone.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        If this person is already in the CRM under another record, choose the record to keep. This one is then hidden
        from searches and lists, with a link to the kept record. Nothing is deleted.
      </p>
      <SearchPicker
        name="merged_into_id"
        options={options}
        value={keepId}
        onChange={setKeepId}
        placeholder="Type the name of the record to keep…"
      />
      {state.error ? <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="outline" disabled={!keepId || isPending} className="w-fit">
        {isPending ? "Saving…" : "Mark as duplicate"}
      </Button>
    </form>
  );
}
