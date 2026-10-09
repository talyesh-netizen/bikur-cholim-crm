"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, X } from "lucide-react";
import { matchFacilities, type MatchableFacility } from "@/lib/facility-match";
import { cn } from "@/lib/utils";

const SHOWN = 8;

/**
 * The one facility chooser (decided Oct 9, 2026): type part of a name
 * and pick it, instead of scrolling a list of every facility. Works the
 * same in forms (pass `name`, saved through a hidden field) and filters
 * (pass `onChange`). Only ever stores an existing facility's id.
 */
export function FacilityPicker({
  facilities,
  name,
  id,
  value: controlledValue,
  defaultValue,
  onChange,
  emptyLabel,
  placeholder = "Type a facility name…",
  className,
}: {
  facilities: MatchableFacility[];
  /** Form field name for the chosen id ("" when none). */
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (facilityId: string) => void;
  /** Offer "none" (e.g. "All facilities", "Not tied to a facility"). */
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;
  const selected = facilities.find((f) => f.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const inputId = id ?? `${autoId}-facility`;
  const listId = `${autoId}-list`;

  const matches = useMemo(() => matchFacilities(facilities, query), [facilities, query]);
  const shown = matches.slice(0, SHOWN);
  const options: { id: string; label: string; detail: string | null }[] = [
    ...(emptyLabel && !query.trim() ? [{ id: "", label: emptyLabel, detail: null }] : []),
    ...shown.map((f) => ({ id: f.id, label: f.name, detail: [f.city, f.parent_healthcare_group].filter(Boolean).join(" · ") || null })),
  ];

  function choose(facilityId: string) {
    if (controlledValue === undefined) setInternalValue(facilityId);
    onChange?.(facilityId);
    setQuery("");
    setOpen(false);
    // Done choosing: put the phone keyboard away.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function openList() {
    setOpen(true);
    setActive(0);
  }

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <div className="relative">
        {open ? (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          id={inputId}
          value={open ? query : (selected?.name ?? "")}
          placeholder={open ? placeholder : (selected?.name ?? emptyLabel ?? placeholder)}
          onFocus={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          // Closing on blur waits a moment, so a tap on a result lands first.
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && options[active]) {
              // Never submits the form: Enter picks the highlighted one.
              e.preventDefault();
              choose(options[active].id);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          className={cn(
            "h-11 w-full rounded-md border border-input bg-background pl-9 pr-9 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
            !open && selected && "font-medium",
            !open && !selected && "placeholder:text-muted-foreground"
          )}
        />
        {selected && emptyLabel !== undefined && !open ? (
          <button
            type="button"
            onClick={() => choose("")}
            aria-label="Clear facility"
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No facility matches &ldquo;{query.trim()}&rdquo;.</li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.id || "none"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.id === value}
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.id);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                  i === active && "bg-muted",
                  !o.id && "text-muted-foreground"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.label}</span>
                  {o.detail ? <span className="block truncate text-xs text-muted-foreground">{o.detail}</span> : null}
                </span>
                {o.id === value ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </li>
            ))
          )}
          {matches.length > SHOWN ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {matches.length - SHOWN} more — keep typing to narrow it down.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
