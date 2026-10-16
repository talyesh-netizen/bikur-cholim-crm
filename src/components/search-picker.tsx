"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { matchFacilities } from "@/lib/facility-match";
import { cn } from "@/lib/utils";
import { useDelayedClose } from "@/components/use-delayed-close";

const SHOWN = 8;

/** One choice in a picker. `detail` shows under the name (e.g. their
 * organization or city); `searchText` is extra words that also find it
 * (an address, a ZIP) without being shown. */
export type PickerOption = {
  id: string;
  label: string;
  detail?: string | null;
  searchText?: string | null;
};

/** Options matching what was typed, best first -- the same forgiving
 * matching as the facility picker (start of any word, initials, any
 * order), so every picker finds things the same way. */
function matchOptions<O extends PickerOption>(options: O[], query: string): O[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  return matchFacilities(
    options.map((o) => ({ id: o.id, name: o.label, address: [o.detail, o.searchText].filter(Boolean).join(" ") })),
    query
  ).map((m) => byId.get(m.id)!);
}

/**
 * The one "pick an existing record" box (decided Oct 9, 2026 for
 * facilities, Oct 16 for everything): type part of a name and pick it,
 * instead of scrolling a long list. Works in forms (pass `name`, saved
 * through a hidden field) and filters (pass `onChange`). Only ever
 * stores an existing record's id.
 */
export function SearchPicker({
  options,
  name,
  id,
  value: controlledValue,
  defaultValue,
  onChange,
  emptyLabel,
  placeholder = "Type a name…",
  icon: Icon,
  className,
}: {
  options: PickerOption[];
  /** Form field name for the chosen id ("" when none). */
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Offer "none" (e.g. "No specific contact"). */
  emptyLabel?: string;
  placeholder?: string;
  /** Shown in the box while closed. */
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { scheduleClose, cancelClose } = useDelayedClose(setOpen, inputRef);
  const autoId = useId();
  const inputId = id ?? `${autoId}-picker`;
  const listId = `${autoId}-list`;

  const matches = useMemo(() => matchOptions(options, query), [options, query]);
  const shown: PickerOption[] = [
    ...(emptyLabel && !query.trim() ? [{ id: "", label: emptyLabel }] : []),
    ...matches.slice(0, SHOWN),
  ];

  function choose(optionId: string) {
    if (controlledValue === undefined) setInternalValue(optionId);
    onChange?.(optionId);
    setQuery("");
    setOpen(false);
    // Done choosing: put the phone keyboard away.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  const ClosedIcon = Icon ?? Search;

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <div className="relative">
        {open ? (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <ClosedIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          id={inputId}
          value={open ? query : (selected?.label ?? "")}
          placeholder={open ? placeholder : (selected?.label ?? emptyLabel ?? placeholder)}
          onFocus={() => {
            cancelClose();
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            cancelClose();
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          // Closing on blur waits a moment, so a tap on a result lands first.
          onBlur={scheduleClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              // Never submits the form: Enter (the phone's Done key) picks
              // the highlighted one, or just closes the list.
              e.preventDefault();
              if (open && shown[active]) choose(shown[active].id);
              else inputRef.current?.blur();
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          className={cn(
            "h-11 w-full rounded-md border border-input bg-background pl-9 pr-9 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
            !open && selected && "font-medium"
          )}
        />
        {selected && emptyLabel !== undefined && !open ? (
          <button
            type="button"
            onClick={() => choose("")}
            aria-label="Clear"
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {open ? (
        <ResultList
          listId={listId}
          options={shown}
          active={active}
          setActive={setActive}
          isSelected={(o) => o.id === value}
          onChoose={choose}
          query={query}
          moreCount={matches.length - SHOWN}
        />
      ) : null}
    </div>
  );
}

/**
 * Several existing records, picked one at a time by typing a name --
 * chosen ones show as chips with an x. Replaces long checkbox lists
 * (e.g. every volunteer). Each chosen id is submitted as `name`.
 */
export function MultiSearchPicker({
  options,
  name,
  id,
  value,
  onChange,
  placeholder = "Type a name to add…",
}: {
  options: PickerOption[];
  name: string;
  id?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { scheduleClose, cancelClose } = useDelayedClose(setOpen, inputRef);
  const autoId = useId();
  const inputId = id ?? `${autoId}-multi`;
  const listId = `${autoId}-list`;

  const chosen = value.map((v) => options.find((o) => o.id === v)).filter((o): o is PickerOption => !!o);
  const available = useMemo(() => options.filter((o) => !value.includes(o.id)), [options, value]);
  const matches = useMemo(() => matchOptions(available, query), [available, query]);
  const shown = matches.slice(0, SHOWN);

  function add(optionId: string) {
    if (!optionId) return;
    onChange([...value, optionId]);
    setQuery("");
    setActive(0);
    // Keep the box open and focused, so the next name can be typed.
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} readOnly />
      ))}
      {chosen.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen">
          {chosen.map((o) => (
            <li key={o.id} className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium">
              {o.label}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== o.id))}
                aria-label={`Remove ${o.label}`}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={inputId}
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            cancelClose();
            setOpen(true);
          }}
          onChange={(e) => {
            cancelClose();
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onBlur={scheduleClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (query.trim() && shown[active]) add(shown[active].id);
              else inputRef.current?.blur();
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
        {open ? (
          <ResultList
            listId={listId}
            options={shown}
            active={active}
            setActive={setActive}
            isSelected={() => false}
            onChoose={add}
            query={query}
            moreCount={matches.length - SHOWN}
          />
        ) : null}
      </div>
    </div>
  );
}

function ResultList({
  listId,
  options,
  active,
  setActive,
  isSelected,
  onChoose,
  query,
  moreCount,
}: {
  listId: string;
  options: PickerOption[];
  active: number;
  setActive: (i: number) => void;
  isSelected: (o: PickerOption) => boolean;
  onChoose: (id: string) => void;
  query: string;
  moreCount: number;
}) {
  return (
    <ul
      id={listId}
      role="listbox"
      className="absolute inset-x-0 top-full z-40 mt-1 max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
    >
      {options.length === 0 ? (
        <li className="px-3 py-3 text-sm text-muted-foreground">
          {query.trim() ? <>Nothing matches &ldquo;{query.trim()}&rdquo;.</> : "Nothing left to choose."}
        </li>
      ) : (
        options.map((o, i) => (
          <li
            key={o.id || "none"}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={isSelected(o)}
            // mousedown, not click: the input's blur would close the list first.
            onMouseDown={(e) => {
              e.preventDefault();
              onChoose(o.id);
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
            {isSelected(o) ? <Check className="size-4 shrink-0 text-primary" /> : null}
          </li>
        ))
      )}
      {moreCount > 0 ? (
        <li className="px-3 py-2 text-xs text-muted-foreground">{moreCount} more — keep typing to narrow it down.</li>
      ) : null}
    </ul>
  );
}
