"use client";

import { useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { searchSuggestions, type Suggestion } from "@/app/(app)/search/actions";

// Wait this long after the last keystroke before asking for suggestions,
// so typing a name sends one request instead of one per letter.
const SUGGEST_DELAY_MS = 200;

/** A single search box, present on every page (see layout.tsx), for
 * jumping straight to anything -- a person, a place, a visit or program
 * note, a task -- instead of navigating to that section first. Matches appear under the
 * box as you type; Enter (with nothing highlighted) opens the full
 * results page. */
export function GlobalSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each keystroke pause gets a number. Answers older than the one on
  // screen, or from before the box was closed or cleared, are ignored.
  const latestRequest = useRef(0);
  const shownRequest = useRef(0);
  const cancelledUpTo = useRef(0);
  // Only one request at a time: the app sends them to the server one
  // after another, so a request per pause would pile up behind each other
  // on a real connection and nothing would show until typing stopped.
  // While one is out, only the newest text waits to go next.
  const inFlight = useRef(false);
  const waiting = useRef<{ text: string; request: number } | null>(null);
  const listId = useId();

  // This bar lives in the shared layout and isn't remounted between
  // pages, so without this, navigating (e.g. browser back/forward)
  // between two different searches would leave the box showing stale
  // text that no longer matches the results below it. Adjusting state
  // during render (React's recommended pattern for this, rather than an
  // effect -- see https://react.dev/learn/you-might-not-need-an-effect)
  // instead of useEffect avoids an extra render pass on every navigation.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  async function fetchSuggestions(text: string, request: number) {
    inFlight.current = true;
    try {
      const found = await searchSuggestions(text);
      // An answer for an earlier pause still shows while typing goes on
      // (the next one replaces it), but never replaces a newer one.
      if (request > shownRequest.current && request > cancelledUpTo.current) {
        shownRequest.current = request;
        setSuggestions(found);
        setActive(-1);
        setOpen(true);
      }
    } catch {
      // Suggestions are a convenience; Enter still opens the full search.
    } finally {
      inFlight.current = false;
      const next = waiting.current;
      waiting.current = null;
      if (next && next.request > cancelledUpTo.current) void fetchSuggestions(next.text, next.request);
    }
  }

  function requestSuggestions(text: string) {
    if (timer.current) clearTimeout(timer.current);
    const request = ++latestRequest.current;
    if (text.trim().length < 2) {
      cancelledUpTo.current = request;
      setSuggestions([]);
      setActive(-1);
      return;
    }
    timer.current = setTimeout(() => {
      if (inFlight.current) waiting.current = { text, request };
      else void fetchSuggestions(text, request);
    }, SUGGEST_DELAY_MS);
  }

  function close() {
    cancelledUpTo.current = ++latestRequest.current;
    waiting.current = null;
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setActive(-1);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  const showList = open && value.trim().length >= 2 && suggestions.length > 0;

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (showList && active >= 0) return go(suggestions[active].href);
        if (value.trim()) go(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
      className="relative z-30 w-full md:max-w-md"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          requestSuggestions(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") return close();
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          }
        }}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label="Search everything in the CRM"
        placeholder="Search everything: names, notes, tasks…"
        className="pl-9"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="absolute inset-x-0 top-full mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur (which closes this
              // list) fires before click would.
              onMouseDown={(e) => {
                e.preventDefault();
                go(s.href);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                i === active ? "bg-muted" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.label}</span>
                {s.sublabel || s.date ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.date, s.sublabel].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{s.kind}</span>
            </li>
          ))}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(e) => {
              e.preventDefault();
              go(`/search?q=${encodeURIComponent(value.trim())}`);
            }}
            className="cursor-pointer border-t border-border px-3 py-2.5 text-sm font-medium text-primary"
          >
            See all results for &ldquo;{value.trim()}&rdquo;
          </li>
        </ul>
      ) : null}
    </form>
  );
}
