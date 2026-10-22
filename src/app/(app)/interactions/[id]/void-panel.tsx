"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { restoreInteraction, voidInteraction } from "@/lib/actions/interactions";
import { Ban, Undo2 } from "lucide-react";

const REASONS = ["Entered twice (duplicate)", "Entered by mistake", "Wrong person, place or day — re-entered correctly"];

/**
 * Void / Restore (director, Oct 21, 2026). A voided entry stays on file
 * and can be put back; it just stops counting. Asks why first.
 */
export function VoidPanel({ id, voided }: { id: string; voided: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const why = reason === "other" ? other.trim() : reason;

  if (voided) {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await restoreInteraction(id);
            if (!r.ok) setError(r.error ?? "Not restored.");
            else router.refresh();
          })
        }
      >
        <Undo2 className="size-4" />
        {pending ? "Restoring…" : "Restore this entry"}
        {error ? <span className="text-destructive"> {error}</span> : null}
      </Button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
      >
        <Ban className="size-4" />
        Void this entry…
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">
        Void this entry? It stays on file and can be restored, but it will no longer count in any report or list.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Why?</legend>
        {[...REASONS, "other"].map((r) => (
          <label key={r} className="flex items-center gap-2">
            <input type="radio" name="void-reason" checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--primary)]" />
            {r === "other" ? "Something else" : r}
          </label>
        ))}
        {reason === "other" ? (
          <input
            type="text"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={300}
            placeholder="Say why"
            aria-label="Why it is being voided"
            className="h-10 rounded-md border border-input bg-background px-3"
          />
        ) : null}
      </fieldset>
      {error ? <p className="text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={!why || pending}
          onClick={() =>
            startTransition(async () => {
              const r = await voidInteraction(id, why);
              if (!r.ok) setError(r.error ?? "Not voided.");
              else {
                setOpen(false);
                router.refresh();
              }
            })
          }
        >
          {pending ? "Voiding…" : "Void entry"}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
