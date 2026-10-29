"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/** A small "i" that shows the full definition of a number when tapped
 * (director, Oct 27, 2026 QA): the page shows a few words, the exact
 * meaning is one tap away. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-label={`What "${label}" counts`}
        aria-expanded={open}
        title={typeof children === "string" ? children : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Info className="size-3.5" />
      </button>
      {open ? (
        <span role="note" className="mt-1 block max-w-56 rounded-md bg-muted px-2 py-1.5 text-xs text-foreground">
          {children}
        </span>
      ) : null}
    </span>
  );
}
