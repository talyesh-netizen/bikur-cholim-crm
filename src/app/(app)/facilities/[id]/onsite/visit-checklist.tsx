"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HOLIDAYS } from "@/lib/domain/interaction";
import type { OnsiteVisitsState } from "@/lib/actions/onsite";
import { CheckCircle2 } from "lucide-react";

type Action = (state: OnsiteVisitsState, formData: FormData) => Promise<OnsiteVisitsState>;

/** "Who did you see today?" -- tick residents, one optional note and
 * holiday for all of them, and one tap logs a visit for each. */
export function VisitChecklist({
  action,
  residents,
}: {
  action: Action;
  residents: { id: string; name: string; detail: string; needsVisit: boolean }[];
}) {
  const [state, formAction, isPending] = useActionState<OnsiteVisitsState, FormData>(action, { error: null });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const [notes, setNotes] = useState("");

  // After a successful save: clear the ticks and start a new batch, so
  // the next save is a new set of visits (not a repeat of this one).
  // (Adjusting state during render, React's recommended alternative to
  // an effect for "reset when a prop/result changes".)
  const [handledSavedAt, setHandledSavedAt] = useState<number | undefined>(undefined);
  if (state.savedAt && !state.error && state.savedAt !== handledSavedAt) {
    setHandledSavedAt(state.savedAt);
    setChecked(new Set());
    setNotes("");
    setBatchId(crypto.randomUUID());
  }

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (residents.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="batch_id" value={batchId} readOnly />
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="resident_id" value={id} readOnly />
      ))}

      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {residents.map((r) => (
          <li key={r.id}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-[var(--primary)]"
                checked={checked.has(r.id)}
                onChange={() => toggle(r.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">{r.name}</span>
                <span className="block text-xs text-muted-foreground">{r.detail}</span>
              </span>
              {r.needsVisit ? (
                <span className="shrink-0 rounded-full bg-tone-attention-bg px-2 py-0.5 text-xs font-medium text-tone-attention-fg">
                  Due
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>

      <Textarea
        name="notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional note for all of them (e.g. “Brought Shabbos candles”)"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Holiday:
          <select name="holiday" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" defaultValue="">
            <option value="">None</option>
            {HOLIDAYS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="ml-auto" disabled={isPending || checked.size === 0}>
          {isPending ? "Saving…" : checked.size === 0 ? "Save visits" : `Save ${checked.size} visit${checked.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state.saved ? (
        <p className="flex items-center gap-1.5 text-sm text-tone-good-fg">
          <CheckCircle2 className="size-4" />
          Saved {state.saved} visit{state.saved === 1 ? "" : "s"}.
        </p>
      ) : null}
    </form>
  );
}
