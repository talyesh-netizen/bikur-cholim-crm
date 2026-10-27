"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FACILITY_STAFF_ROLES } from "@/lib/domain/contact";
import { cn } from "@/lib/utils";

const OTHER = "__other__";

/** A facility staff member's role (director, Oct 27, 2026): one of the
 * usual titles, or Other with its own title. A title already saved that
 * isn't exactly one of the usual ones shows as Other with that text, so
 * saving the form keeps it exactly as it was. */
export function StaffRoleField({
  id,
  name,
  defaultValue = "",
  onChange,
  className,
}: {
  id?: string;
  /** The form field holding the role text; leave out when using onChange. */
  name?: string;
  defaultValue?: string;
  onChange?: (role: string) => void;
  className?: string;
}) {
  const saved = defaultValue ?? "";
  const known = (FACILITY_STAFF_ROLES as readonly string[]).includes(saved);
  const [choice, setChoice] = useState(saved === "" ? "" : known ? saved : OTHER);
  const [other, setOther] = useState(known ? "" : saved);
  const value = choice === OTHER ? other : choice;

  function update(nextChoice: string, nextOther: string) {
    setChoice(nextChoice);
    setOther(nextOther);
    onChange?.(nextChoice === OTHER ? nextOther : nextChoice);
  }

  return (
    <div className="flex flex-col gap-2">
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <select
        id={id}
        value={choice}
        onChange={(e) => update(e.target.value, other)}
        className={cn("h-10 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm", className)}
      >
        <option value="">No role given</option>
        {FACILITY_STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {choice === OTHER ? (
        <Input
          aria-label="Their title"
          placeholder="Type their title"
          value={other}
          onChange={(e) => update(OTHER, e.target.value)}
          className={className}
        />
      ) : null}
    </div>
  );
}
