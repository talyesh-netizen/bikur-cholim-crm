"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERACTION_TYPES } from "@/lib/domain/interaction";
import { Search } from "lucide-react";

export function InteractionFilters({
  facilities,
}: {
  facilities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("search", search || null);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={searchParams.get("type") ?? "all"}
            onValueChange={(v) => updateParam("type", v === "all" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {INTERACTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Facility</Label>
          <Select
            value={searchParams.get("facility") ?? "all"}
            onValueChange={(v) => updateParam("facility", v === "all" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All facilities</SelectItem>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Show</Label>
          <Select
            value={searchParams.get("flag") ?? "all"}
            onValueChange={(v) => updateParam("flag", v === "all" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everything</SelectItem>
              <SelectItem value="funder_story">Good stories for funders</SelectItem>
              <SelectItem value="unmet_need">Requests we couldn&apos;t meet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Date range</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              defaultValue={searchParams.get("from") ?? ""}
              onChange={(e) => updateParam("from", e.target.value || null)}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              defaultValue={searchParams.get("to") ?? ""}
              onChange={(e) => updateParam("to", e.target.value || null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
