"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Which period a report covers (director, Oct 21, 2026): quick choices
 * for the usual ones, plus any month, any quarter, or any range of days.
 * Everything is a plain link (?period=2026-Q3 or ?from=…&to=…), so a
 * chosen period can be bookmarked or sent to someone.
 */
export function PeriodPicker({
  basePath,
  currentKey,
  quick,
  months,
  quarters,
  extraParams = "",
}: {
  /** The page to open, e.g. "/impact" or "/facilities/…". */
  basePath: string;
  /** The period showing now (its key, e.g. "2026-Q3"). */
  currentKey: string;
  /** "This quarter", "Last quarter", ... with their keys. */
  quick: { key: string; label: string }[];
  /** Months to offer, newest first. */
  months: { key: string; label: string }[];
  /** Quarters to offer, newest first. */
  quarters: { key: string; label: string }[];
  /** Other query parameters to keep (e.g. "&tab=impact"). */
  extraParams?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const hrefFor = (key: string) => `${basePath}?period=${encodeURIComponent(key)}${extraParams}`;
  const isQuick = quick.some((q) => q.key === currentKey);

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Time period" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {quick.map((q) => (
          <Link
            key={q.key}
            href={hrefFor(q.key)}
            aria-current={q.key === currentKey ? "true" : undefined}
            className={
              q.key === currentKey
                ? "rounded-md bg-card px-3 py-2 text-sm font-semibold shadow-sm"
                : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {q.label}
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium",
            !isQuick ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Other period…
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">A quarter</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-2"
              value={quarters.some((q) => q.key === currentKey) ? currentKey : ""}
              onChange={(e) => e.target.value && router.push(hrefFor(e.target.value))}
            >
              <option value="">Choose a quarter…</option>
              {quarters.map((q) => (
                <option key={q.key} value={q.key}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">A month</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-2"
              value={months.some((m) => m.key === currentKey) ? currentKey : ""}
              onChange={(e) => e.target.value && router.push(hrefFor(e.target.value))}
            >
              <option value="">Choose a month…</option>
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <form
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to) router.push(`${basePath}?from=${from}&to=${to}${extraParams}`);
            }}
          >
            <span className="font-medium">Any dates</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="From"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-2"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                aria-label="To"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-2"
              />
              <Button type="submit" size="sm" disabled={!from || !to}>
                Show
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
