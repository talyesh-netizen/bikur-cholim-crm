"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, HandHeart, Cookie, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type Resident = { id: string; name: string; room: string | null; lastVisit: string; lastVisitAt: string | null; needsVisit: boolean; seenToday: boolean };

export function ResidentDirectory({ facilityId, residents }: { facilityId: string; residents: Resident[] }) {
  const [search, setSearch] = useState("");
  const [showSeen, setShowSeen] = useState(false);
  const query = search.trim().toLowerCase();
  const seenCount = residents.filter((r) => r.seenToday).length;
  const toSee = residents.length - seenCount;
  // Anyone visited today drops off the list; a search still finds them,
  // so a second note for someone already seen is never out of reach.
  const filtered = useMemo(() => residents.filter((r) =>
    (query || showSeen || !r.seenToday) && (r.name + " " + (r.room ?? "")).toLowerCase().includes(query)
  ).sort((a, b) => (a.room ?? "ZZZZ").localeCompare(b.room ?? "ZZZZ", undefined, { numeric: true })), [residents, query, showSeen]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline justify-between gap-2 text-lg">
          Residents
          <span className="text-sm font-normal text-muted-foreground">
            {residents.length === 0 ? "" : toSee === 0 ? "Everyone seen today" : `${toSee} to see today`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label="Search residents by name or room" placeholder="Search name or room" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {query ? "No one by that name or room." : residents.length ? "Everyone here has been seen today." : "No residents on file here yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">{filtered.map((resident) => {
            const logHref = `/interactions/new?facility=${facilityId}&resident=${resident.id}&from=onsite`;
            return <li key={resident.id} className="flex flex-col gap-3 p-3">
              <Link href={`/residents/${resident.id}`} className="flex min-w-0 items-center gap-3">
                {/* The room, big, so the list can be walked door by door. */}
                <span className={`flex h-12 w-14 shrink-0 items-center justify-center rounded-md px-1 [overflow-wrap:anywhere] text-center font-semibold leading-tight ${resident.room ? "bg-secondary text-base" : "border border-dashed text-xs text-muted-foreground"}`}>
                  {resident.room ?? "No room"}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{resident.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    {resident.seenToday ? <StatusBadge tone="good">Seen today</StatusBadge>
                      : resident.needsVisit ? <StatusBadge tone="attention">Visit due</StatusBadge> : null}
                    {resident.seenToday ? null : <span>{resident.lastVisitAt ? `Last visit ${resident.lastVisit.replace("Yesterday", "yesterday")}` : "Never visited"}</span>}
                  </span>
                </span>
              </Link>
              <div className="grid grid-cols-3 gap-2">
                <Button className="h-11 min-w-0 px-2" asChild><Link href={`${logHref}&type=resident_visit`}><HandHeart /> Visit</Link></Button>
                <Button variant="outline" className="h-11 min-w-0 px-2" asChild><Link href={`${logHref}&type=food_delivery`}><Cookie /> Food</Link></Button>
                <Button variant="outline" className="h-11 min-w-0 px-2" asChild><Link href={`${logHref}&type=other`}><StickyNote /> Note</Link></Button>
              </div>
            </li>;
          })}</ul>
        )}
        {seenCount > 0 && !query ? (
          <button type="button" onClick={() => setShowSeen(!showSeen)} className="min-h-11 w-full py-2 text-center text-sm text-muted-foreground underline underline-offset-2">
            {showSeen ? "Hide" : "Show"} the {seenCount} seen today
          </button>
        ) : null}
        <Button variant="outline" className="w-full border-dashed" asChild>
          <Link href={`/residents/new?facility=${facilityId}`}><Plus /> Add a new resident</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
