"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Resident = { id: string; name: string; room: string | null; lastVisit: string; needsVisit: boolean; seenToday: boolean };

export function ResidentDirectory({ facilityId, residents }: { facilityId: string; residents: Resident[] }) {
  const [search, setSearch] = useState("");
  const [showSeen, setShowSeen] = useState(false);
  const query = search.trim().toLowerCase();
  const seenCount = residents.filter((r) => r.seenToday).length;
  // Anyone visited today drops off the list; a search still finds them,
  // so a second note for someone already seen is never out of reach.
  const filtered = useMemo(() => residents.filter((r) =>
    (query || showSeen || !r.seenToday) && (r.name + " " + (r.room ?? "")).toLowerCase().includes(query)
  ).sort((a, b) => (a.room ?? "ZZZZ").localeCompare(b.room ?? "ZZZZ", undefined, { numeric: true })), [residents, query, showSeen]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">Resident directory ({residents.length - seenCount})</CardTitle>
        <Button size="sm" variant="outline" asChild><Link href={`/residents/new?facility=${facilityId}`}><Plus className="size-4" /> Add resident</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search residents by name or room" placeholder="Search name or room" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">{query ? "No matching residents." : residents.length ? "Everyone here has been seen today." : "No current residents on file."}</p> :
          <ul className="divide-y rounded-md border">{filtered.map((resident) => <li key={resident.id} className="flex items-center justify-between gap-2 px-3 py-3">
            <Link href={`/residents/${resident.id}`} className="min-w-0 flex-1 hover:underline"><span className="block font-medium">{resident.name}</span><span className="block text-sm text-muted-foreground">{resident.room ? `Room / Apt ${resident.room}` : "Room not recorded"} · {resident.seenToday ? "Seen today" : resident.lastVisit}{resident.needsVisit ? " · Visit due" : ""}</span></Link>
            <Button size="sm" variant="outline" asChild><Link href={`/interactions/new?facility=${facilityId}&resident=${resident.id}&from=onsite`}><ClipboardList className="size-4" /> Log</Link></Button>
          </li>)}</ul>}
        {seenCount > 0 && !query ? (
          <button type="button" onClick={() => setShowSeen(!showSeen)} className="text-sm text-muted-foreground underline underline-offset-2">
            {showSeen ? "Hide" : "Show"} {seenCount} seen today
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
