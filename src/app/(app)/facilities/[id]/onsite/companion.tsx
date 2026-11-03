"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { recordCompanionPresence } from "@/lib/actions/onsite-entries";
import { getLocalToday } from "@/lib/format-date";

/**
 * "Visiting with [colleague]" (Q-N2, D8, Nov 3, 2026): picked once per
 * facility visit. It records the colleague's own presence at this
 * facility today (one Facility visit, never two), and offers "With
 * [name]" on each card -- off unless ticked, so resident logging stays one
 * tap and no entry credits someone who wasn't part of it.
 *
 * Remembered on this phone for this facility and day only.
 */

export type Companion = { id: string; name: string };

const CompanionContext = createContext<Companion | null>(null);

export function useCompanion(): Companion | null {
  return useContext(CompanionContext);
}

const storageKey = (facilityId: string) => `onsite-companion:${facilityId}:${getLocalToday()}`;

function readStored(facilityId: string): Companion | null {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(facilityId)) ?? "null") as Companion | null;
  } catch {
    return null;
  }
}

/** Forget the colleague picked here today (Finish visit). */
export function clearCompanion(facilityId: string) {
  try {
    window.localStorage.removeItem(storageKey(facilityId));
  } catch {
    // Nothing kept.
  }
}

export function CompanionProvider({ facilityId, children }: { facilityId: string; children: (api: CompanionApi) => React.ReactNode }) {
  const [companion, setCompanion] = useState<Companion | null>(null);
  useEffect(() => {
    // Read after mount: the phone's memory isn't there on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompanion(readStored(facilityId));
  }, [facilityId]);
  const api: CompanionApi = {
    companion,
    choose: (c) => {
      setCompanion(c);
      try {
        if (c) window.localStorage.setItem(storageKey(facilityId), JSON.stringify(c));
        else window.localStorage.removeItem(storageKey(facilityId));
      } catch {
        // Kept for this page only.
      }
    },
  };
  return <CompanionContext.Provider value={companion}>{children(api)}</CompanionContext.Provider>;
}

export type CompanionApi = { companion: Companion | null; choose: (c: Companion | null) => void };

export function VisitingWith({ facilityId, colleagues, api }: { facilityId: string; colleagues: Companion[]; api: CompanionApi }) {
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (c: Companion) => {
    setError(null);
    startTransition(async () => {
      const result = await recordCompanionPresence({ facilityId, profileId: c.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      api.choose(c);
      setPicking(false);
      setMessage(
        result.already
          ? `${c.name}'s visit here today was already recorded.`
          : `${c.name}'s visit here today is recorded. Tick “With ${c.name.split(" ")[0]}” on a card only when they took part in it.`
      );
    });
  };

  if (colleagues.length === 0) return null;

  if (api.companion) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>
            Visiting with <span className="font-semibold">{api.companion.name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              api.choose(null);
              setMessage("Stopped. Their visit already recorded stays; void it from Today if it was a mistake.");
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> Stop
          </button>
        </div>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {picking ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <p className="font-medium">Who is with you?</p>
          <div className="flex flex-wrap gap-2">
            {colleagues.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => pick(c)}
                className="rounded-full bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-border hover:ring-primary/50"
              >
                {c.name}
              </button>
            ))}
            <button type="button" onClick={() => setPicking(false)} className="px-2 text-xs text-muted-foreground">
              Cancel
            </button>
          </div>
          {pending ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Recording…
            </p>
          ) : null}
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <UserPlus className="size-4" /> Visiting with a colleague?
        </button>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

/** "With Sara" on one card: off unless ticked. */
export function WithCompanionToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const companion = useCompanion();
  if (!companion) return null;
  const first = companion.name.split(" ")[0];
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={
        on
          ? "w-fit rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          : "w-fit rounded-full bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-border hover:ring-primary/50"
      }
    >
      {on ? `✓ With ${first}` : `+ With ${first}`}
    </button>
  );
}
