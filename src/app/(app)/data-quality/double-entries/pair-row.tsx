"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reviewDoubleEntry, undoDoubleEntryReview } from "@/lib/actions/double-entries";
import type { DoubleEntryPair, DoubleEntrySide } from "@/lib/queries/double-entries";
import { formatDateTimeWithTime } from "@/lib/format-date";

function Side({ title, s }: { title: string; s: DoubleEntrySide }) {
  return (
    <Link href={`/interactions/${s.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border border-border p-2.5 text-sm hover:border-primary/50">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className="font-medium">{s.staff_name ?? "Unknown staff"}</span>
      <span className="text-xs text-muted-foreground">
        {formatDateTimeWithTime(s.occurred_at)}
        {s.facility_name ? ` · ${s.facility_name}` : ""}
      </span>
      {s.notes ? <span className="line-clamp-2 text-xs">{s.notes}</span> : null}
    </Link>
  );
}

/** One suspected double entry: shown side by side, answered by an admin
 * with "Same visit" or "Separate visits" -- never decided for them. */
export function PairRow({ pair, typeLabel, canReview }: { pair: DoubleEntryPair; typeLabel: string; canReview: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"same" | "separate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = (decision: "same" | "separate") =>
    startTransition(async () => {
      setError(null);
      const result = await reviewDoubleEntry(pair.kept.id, pair.other.id, decision);
      if (result.ok) setDone(decision);
      else setError(result.error ?? "Not saved.");
    });

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0">
      <p className="text-sm">
        <span className="font-semibold">{pair.person}</span> · {typeLabel} · {pair.day}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Side title="Entered first" s={pair.kept} />
        <Side title="Entered second" s={pair.other} />
      </div>
      {done ? (
        <p role="status" className="text-sm font-medium text-success">
          {pair.kind === "meeting"
            ? done === "same"
              ? "Saved: one meeting, with both people on it. The second entry is kept for the record."
              : "Saved: separate meetings, both counted."
            : done === "same"
              ? "Saved: counted once. Both staff members keep credit; the second entry is kept for the record."
              : "Saved: separate visits, both counted."}
        </p>
      ) : canReview ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => answer("same")}>
            {pair.kind === "meeting" ? "Same meeting (count once)" : "Same visit (count once)"}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("separate")}>
            {pair.kind === "meeting" ? "Separate meetings" : "Separate visits"}
          </Button>
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">An admin reviews these.</p>
      )}
    </li>
  );
}

export function UndoReviewButton({ reviewId }: { reviewId: string }) {
  const [pending, startTransition] = useTransition();
  const [undone, setUndone] = useState(false);
  if (undone) return <span className="text-xs text-muted-foreground">Undone</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await undoDoubleEntryReview(reviewId);
          if (result.ok) setUndone(true);
        })
      }
      className="text-xs text-muted-foreground underline hover:text-foreground"
    >
      Undo
    </button>
  );
}

/** The pairs to review, as the page first showed them: an answered pair
 * stays in place showing "Saved" (the page refreshes behind it after
 * each answer) until the person leaves the page. */
export function PairList({ pairs, typeLabels, canReview }: { pairs: DoubleEntryPair[]; typeLabels: Record<string, string>; canReview: boolean }) {
  const [shown] = useState(pairs);
  return (
    <ul className="flex flex-col">
      {shown.map((pair) => (
        <PairRow key={pair.key} pair={pair} typeLabel={typeLabels[pair.type] ?? pair.type} canReview={canReview} />
      ))}
    </ul>
  );
}
