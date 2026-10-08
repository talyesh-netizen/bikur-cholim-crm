"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORGANIZATION_TYPES, OFFERED_PARTNER_TYPES } from "@/lib/domain/organization";
import { Search } from "lucide-react";

export function OrganizationFilters() {
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
            placeholder="Search by name…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-1 sm:w-64">
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
            {ORGANIZATION_TYPES.filter((t) => (OFFERED_PARTNER_TYPES as readonly string[]).includes(t.value)).map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="show-inactive"
          checked={searchParams.get("all") === "1"}
          onCheckedChange={(checked) => updateParam("all", checked ? "1" : null)}
        />
        <Label htmlFor="show-inactive" className="text-sm font-normal text-muted-foreground">
          Include inactive organizations
        </Label>
      </div>
    </div>
  );
}
