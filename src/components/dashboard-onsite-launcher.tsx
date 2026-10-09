"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ClipboardCheck, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAST_ONSITE_KEY } from "@/components/remember-onsite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionIcon } from "@/components/section-icon";
import { mapsHref } from "@/lib/link-helpers";
import { matchFacilities } from "@/lib/facility-match";

type OnsiteFacility = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  zip: string | null;
};

function facilityAddress(facility: OnsiteFacility) {
  return [
    facility.address,
    [facility.city, facility.zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

export function DashboardOnsiteLauncher({
  facilities,
}: {
  facilities: OnsiteFacility[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [showResults, setShowResults] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // The facility visited last today, offered as one tap to carry on.
  const [lastVisit, setLastVisit] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(LAST_ONSITE_KEY) ?? "null") as { id: string; name: string; at: number } | null;
        if (saved && Date.now() - saved.at < 12 * 60 * 60 * 1000 && facilities.some((f) => f.id === saved.id)) {
          setLastVisit({ id: saved.id, name: saved.name });
        }
      } catch {
        // Nothing remembered.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [facilities]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (target && !pickerRef.current?.contains(target)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const selectedFacility = facilities.find((facility) => facility.id === facilityId) ?? null;

  // Name, street, city or ZIP -- the same matching as every other
  // facility picker (lib/facility-match).
  const matches = useMemo(() => matchFacilities(facilities, query, 10), [facilities, query]);

  function chooseFacility(facility: OnsiteFacility) {
    setFacilityId(facility.id);
    setQuery(facility.name);
    setShowResults(false);
  }

  function startOnsite() {
    if (!facilityId) return;
    router.push(`/facilities/${facilityId}/onsite`);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setFacilityId("");
    setShowResults(true);
  }

  const selectedAddress = selectedFacility ? facilityAddress(selectedFacility) : "";
  const directionsHref = mapsHref(selectedAddress);

  return (
    <Card className="border-t-4" style={{ borderTopColor: "var(--section-facilities)" }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base uppercase tracking-wide">
          <SectionIcon section="facilities" icon={ClipboardCheck} />
          Start a visit
        </CardTitle>
        <p className="text-sm text-muted-foreground">Pick the facility you&apos;re at, then tap to talk.</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {lastVisit && !selectedFacility ? (
          <Button size="lg" className="h-12 justify-start text-base" onClick={() => router.push(`/facilities/${lastVisit.id}/onsite`)}>
            <ClipboardCheck className="size-5" />
            <span className="truncate">Continue at {lastVisit.name}</span>
          </Button>
        ) : null}
        <div ref={pickerRef} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            autoCapitalize="words"
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowResults(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length === 1) {
                e.preventDefault();
                chooseFacility(matches[0]);
              }
              if (e.key === "Escape") setShowResults(false);
            }}
            placeholder="Type a facility name or address"
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-9 text-base outline-none sm:text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search for facility for onsite visit"
            autoComplete="off"
          />
          {selectedFacility ? (
            <Check className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-success" />
          ) : null}

          {showResults ? (
            <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
              {matches.length > 0 ? (
                matches.map((facility) => {
                  const address = facilityAddress(facility);
                  return (
                    <button
                      key={facility.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseFacility(facility)}
                      className="flex w-full items-start gap-2 rounded-sm px-3 py-2.5 text-left hover:bg-accent"
                    >
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{facility.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {address || "Address not recorded"}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">No matching facilities.</p>
              )}
            </div>
          ) : null}
        </div>

        {selectedFacility ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{selectedFacility.name}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>{selectedAddress || "Address not recorded"}</span>
              </p>
            </div>

            <div className="flex gap-2">
              {directionsHref ? (
                <Button variant="outline" asChild className="flex-1 sm:flex-none">
                  <a href={directionsHref} target="_blank" rel="noreferrer">
                    <MapPin className="size-4" />
                    Directions
                  </a>
                </Button>
              ) : null}
              <Button onClick={startOnsite} className="flex-1 uppercase tracking-wide sm:flex-none">
                <ClipboardCheck className="size-4" />
                Start onsite
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Search by facility name, street, city, or ZIP.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
