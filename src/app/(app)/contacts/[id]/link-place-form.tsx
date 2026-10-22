"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchPicker, type PickerOption } from "@/components/search-picker";
import type { LinkPlaceState } from "@/lib/actions/contacts";

type Action = (state: LinkPlaceState, formData: FormData) => Promise<LinkPlaceState>;

/** "+ Link to a facility or partner" on a contact's page: one search for
 * both, and an optional role ("Activities director"). */
export function LinkPlaceForm({ action, options }: { action: Action; options: PickerOption[] }) {
  const [state, formAction, isPending] = useActionState<LinkPlaceState, FormData>(action, { error: null });
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        + Link to a facility or partner
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3">
      <SearchPicker
        name="place"
        options={options}
        value={place}
        onChange={setPlace}
        placeholder="Type a facility or partner (e.g. LCS)…"
      />
      <Input name="role" placeholder="Their role there (optional)" aria-label="Their role there (optional)" />
      {state.error ? <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!place || isPending}>
          {isPending ? "Saving…" : "Link"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
