"use client";

import { OFFERED_FACILITY_TYPES, FACILITY_TYPES } from "@/lib/domain/facility";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GeographicCluster } from "@/lib/domain/facility";
import { Search, X } from "lucide-react";

/** The filters a fresh Facilities page starts without (its default view:
 * active facilities, A to Z). */
const FILTER_KEYS = ["search", "cluster", "type", "residents", "inactive"] as const;

/**
 * Facilities filters (Nov 27, 2026): search, area, type, "with Jewish
 * residents on file" and "show inactive". Engagement status and visit
 * priority are no longer part of the staff workflow (data kept). Clear
 * search clears the text at once; Clear all filters goes back to the
 * default view.
 */
export function FacilityFilters({ clusters }: { clusters: GeographicCluster[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [, startTransition] = useTransition();

  function push(params: URLSearchParams) {
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    push(params);
  }

  const anyFilter = FILTER_KEYS.some((k) => searchParams.get(k));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("search", search.trim() || null);
        }}
        className="flex gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            enterKeyHint="search"
            placeholder="Search by name, city or group…"
            aria-label="Search facilities"
            className="pl-9 pr-10"
          />
          {search || searchParams.get("search") ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                updateParam("search", null);
              }}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Area</Label>
          <Select value={searchParams.get("cluster") ?? "all"} onValueChange={(v) => updateParam("cluster", v === "all" ? null : v)}>
            <SelectTrigger aria-label="Area">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {clusters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Facility type</Label>
          <Select value={searchParams.get("type") ?? "all"} onValueChange={(v) => updateParam("type", v === "all" ? null : v)}>
            <SelectTrigger aria-label="Facility type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {FACILITY_TYPES.filter((t) => (OFFERED_FACILITY_TYPES as readonly string[]).includes(t.value)).map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="with-residents"
          checked={searchParams.get("residents") === "1"}
          onCheckedChange={(checked) => updateParam("residents", checked ? "1" : null)}
        />
        <Label htmlFor="with-residents" className="text-sm font-medium">
          Only facilities with Jewish residents on file
        </Label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inactive"
            checked={searchParams.get("inactive") === "1"}
            onCheckedChange={(checked) => updateParam("inactive", checked ? "1" : null)}
          />
          <Label htmlFor="show-inactive" className="text-sm font-normal text-muted-foreground">
            Show inactive facilities
          </Label>
        </div>
        {anyFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              push(new URLSearchParams());
            }}
          >
            <X className="size-4" /> Clear all filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
