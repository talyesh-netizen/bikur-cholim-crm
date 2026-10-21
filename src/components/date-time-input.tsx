"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A date box and a time box side by side, standing in for the browser's
 * single "date and time" box -- whose calendar stays open after a day is
 * picked, waiting for a time. A date-only calendar closes as soon as a
 * day is tapped (director, Oct 21, 2026).
 *
 * Works with the same "YYYY-MM-DDTHH:mm" value the old box used: pass
 * `name` to send it with a form (uncontrolled, from `defaultValue`), or
 * `value` + `onChange` to manage it yourself. The value is "" until both
 * a date and a time are filled in.
 */
export function DateTimeInput({
  name,
  id,
  value: controlledValue,
  defaultValue,
  onChange,
  required,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  /** Overrides the boxes' look (e.g. a smaller height in a tight card). */
  inputClassName?: string;
  "aria-label"?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const value = controlledValue ?? internal;
  // Kept apart so clearing one box doesn't wipe what's in the other.
  const [date, setDate] = useState(value.slice(0, 10));
  const [time, setTime] = useState(value.slice(11, 16));
  // Follow a value changed from outside (e.g. a "use this date" fix).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value) {
      setDate(value.slice(0, 10));
      setTime(value.slice(11, 16));
    }
  }

  function update(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : "";
    setSeen(next);
    if (controlledValue === undefined) setInternal(next);
    onChange?.(next);
  }

  const box = cn(
    "h-11 rounded-md border border-input bg-background px-3 text-base shadow-sm md:h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    inputClassName
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label={ariaLabel}>
      {name ? <input type="hidden" name={name} value={date && time ? `${date}T${time}` : ""} readOnly /> : null}
      <input
        id={id}
        type="date"
        aria-label={ariaLabel ? `${ariaLabel}: date` : "Date"}
        value={date}
        required={required}
        onChange={(e) => update(e.target.value, time)}
        className={cn(box, "min-w-0 flex-1 basis-40")}
      />
      <input
        type="time"
        aria-label={ariaLabel ? `${ariaLabel}: time` : "Time"}
        value={time}
        required={required}
        onChange={(e) => update(date, e.target.value)}
        className={cn(box, "w-32 shrink-0")}
      />
    </div>
  );
}
