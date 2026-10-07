"use client";

import { useMemo, useState } from "react";
import { Building2, MapPinOff, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VoiceButton } from "@/components/voice-button";

export type PlaceFacility = { id: string; name: string; city: string | null };

/** Where the note's events happened, chosen before talking. */
export type Place =
  | { kind: "facility"; id: string; name: string }
  | { kind: "new"; name: string }
  | { kind: "none" };

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Quick Log's first question: "Where did it happen?" Type or say the
 * place, pick it from the list, add it as a new facility if it isn't in
 * the CRM, or skip for a reminder, a phone call or several places.
 */
export function PlacePicker({ facilities, onChoose }: { facilities: PlaceFacility[]; onChoose: (place: Place) => void }) {
  const [query, setQuery] = useState("");
  const typed = query.trim();

  const matches = useMemo(() => {
    const wanted = words(typed);
    if (wanted.length === 0) return [];
    return facilities
      .filter((f) => {
        const have = words(`${f.name} ${f.city ?? ""}`);
        return wanted.every((w) => have.some((h) => h.startsWith(w)));
      })
      .slice(0, 6);
  }, [facilities, typed]);

  const exact = matches.some((f) => f.name.toLowerCase() === typed.toLowerCase());

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <label htmlFor="quick-log-place" className="text-base font-semibold">
          Where did it happen?
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="quick-log-place"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a facility name"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-base"
          />
        </div>
        <VoiceButton compact label="Say the place" onText={(text) => setQuery(text.replace(/[.?!]+$/, ""))} />

        {matches.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {matches.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onChoose({ kind: "facility", id: f.id, name: f.name })}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-primary/50"
                >
                  <Building2 className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block font-medium">{f.name}</span>
                    {f.city ? <span className="block text-xs text-muted-foreground">{f.city}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : typed ? (
          <p className="text-sm text-muted-foreground">No facility in the CRM matches &ldquo;{typed}&rdquo;.</p>
        ) : null}

        {typed && !exact ? (
          <Button type="button" variant="outline" className="h-auto justify-start gap-2 whitespace-normal py-2.5 text-left" onClick={() => onChoose({ kind: "new", name: typed })}>
            <Plus className="size-4 shrink-0" /> Add &ldquo;{typed}&rdquo; as a new facility
          </Button>
        ) : null}

        <Button type="button" variant="ghost" className="h-auto justify-start gap-2 whitespace-normal py-2.5 text-left text-muted-foreground" onClick={() => onChoose({ kind: "none" })}>
          <MapPinOff className="size-4 shrink-0" /> Not one place (a reminder, a phone call, several places)
        </Button>
      </CardContent>
    </Card>
  );
}
