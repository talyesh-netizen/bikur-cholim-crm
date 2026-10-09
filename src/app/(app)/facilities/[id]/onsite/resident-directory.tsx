"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, HandHeart, ChevronDown, Phone, MessageCircle, ListChecks, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { EntryCard } from "./entry-card";
import { AddPerson } from "./add-person";
import { draftsAt } from "./onsite-drafts";

export type DirectoryFamily = { contactId: string; name: string; relationship: string; phone: string | null };

export type DirectoryResident = {
  id: string;
  name: string;
  room: string | null;
  lastVisit: string;
  lastVisitAt: string | null;
  needsVisit: boolean;
  seenToday: boolean;
  /** Newest "About them" notes, shown when the resident is opened. */
  notes?: { text: string; date: string }[];
  family?: DirectoryFamily[];
  openTasks?: number;
  /** Staff who already logged a visit with them today. */
  visitedTodayBy?: string[];
};

/** The on-site visit workflow (director, Oct 9, 2026): find someone,
 * tap Visit, type or dictate what happened (or nothing), Save -- a real
 * visit, saved right here -- then on to the next person. Tapping the
 * name opens what to know before going in (their notes, their family)
 * and the other things to do for them. Adding a resident or a family
 * member happens here too, then goes straight to recording. */
export function ResidentDirectory({
  facilityId,
  residents,
  initiallyOpen,
  initialVisit = false,
}: {
  facilityId: string;
  residents: DirectoryResident[];
  /** A resident to show opened (coming back from adding their family). */
  initiallyOpen?: string;
  /** Open that resident's visit card too. */
  initialVisit?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showSeen, setShowSeen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initiallyOpen ?? null);
  // Visit card open for this resident (inside their opened row).
  const [visiting, setVisiting] = useState<string | null>(initialVisit ? (initiallyOpen ?? null) : null);
  const [adding, setAdding] = useState(false);
  // Residents with a note typed here earlier but not saved yet.
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = window.setTimeout(() => setDrafts(draftsAt(facilityId)), 0);
    return () => window.clearTimeout(t);
  }, [facilityId, visiting]);

  const startVisit = (residentId: string) => {
    setOpenId(residentId);
    setVisiting(residentId);
  };
  const query = search.trim().toLowerCase();
  const seenCount = residents.filter((r) => r.seenToday).length;
  const toSee = residents.length - seenCount;
  // Anyone visited today drops off the list; a search still finds them,
  // so a second note for someone already seen is never out of reach. A
  // resident who's opened stays put.
  const filtered = useMemo(() => residents.filter((r) =>
    (query || showSeen || !r.seenToday || r.id === openId) && (r.name + " " + (r.room ?? "")).toLowerCase().includes(query)
  ).sort((a, b) => (a.room ?? "ZZZZ").localeCompare(b.room ?? "ZZZZ", undefined, { numeric: true })), [residents, query, showSeen, openId]);

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
            const isOpen = openId === resident.id;
            return <li key={resident.id}>
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : resident.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {/* The room, big, so the list can be walked door by door. */}
                  <span className={`flex h-12 w-14 shrink-0 items-center justify-center rounded-md px-1 [overflow-wrap:anywhere] text-center font-semibold leading-tight ${resident.room ? "bg-secondary text-base" : "border border-dashed text-xs text-muted-foreground"}`}>
                    {resident.room ?? "No room"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-medium leading-snug">
                      {resident.name}
                      <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                      {drafts.has(resident.id) ? <StatusBadge tone="urgent">Unsaved note</StatusBadge> : null}
                      {resident.seenToday ? <StatusBadge tone="good">Seen today</StatusBadge>
                        : resident.needsVisit ? <StatusBadge tone="attention">Visit due</StatusBadge> : null}
                      {resident.seenToday ? null : <span>{resident.lastVisitAt ? `Last visit ${resident.lastVisit.replace("Yesterday", "yesterday")}` : "Never visited"}</span>}
                    </span>
                  </span>
                </button>
                <Button className="h-11 shrink-0 px-4" onClick={() => startVisit(resident.id)} disabled={visiting === resident.id}><HandHeart /> Visit</Button>
              </div>
              {isOpen ? (
                <ResidentPanel
                  facilityId={facilityId}
                  resident={resident}
                  visiting={visiting === resident.id}
                  onVisit={() => setVisiting(resident.id)}
                  onVisitDone={() => {
                    setVisiting(null);
                    setOpenId(null);
                  }}
                />
              ) : null}
            </li>;
          })}</ul>
        )}
        {seenCount > 0 && !query ? (
          <button type="button" onClick={() => setShowSeen(!showSeen)} className="min-h-11 w-full py-2 text-center text-sm text-muted-foreground underline underline-offset-2">
            {showSeen ? "Hide" : "Show"} the {seenCount} seen today
          </button>
        ) : null}
        {adding ? (
          <AddPerson
            kind="resident"
            facilityId={facilityId}
            onCancel={() => setAdding(false)}
            onExistingResidentHere={(id) => {
              setAdding(false);
              setSearch("");
              startVisit(id);
            }}
            // Added: their visit opens straight away.
            onAdded={(person) => {
              setAdding(false);
              setSearch("");
              startVisit(person.id);
            }}
          />
        ) : (
          <Button variant="outline" className="h-11 w-full border-dashed" onClick={() => setAdding(true)}>
            <Plus /> Add a new resident
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ResidentPanel({
  facilityId,
  resident,
  visiting,
  onVisit,
  onVisitDone,
}: {
  facilityId: string;
  resident: DirectoryResident;
  visiting: boolean;
  onVisit: () => void;
  onVisitDone: () => void;
}) {
  const notes = resident.notes ?? [];
  const family = resident.family ?? [];
  // A conversation with one family member, or adding one -- in place.
  const [talkingTo, setTalkingTo] = useState<{ id: string; name: string } | null>(null);
  const [addingFamily, setAddingFamily] = useState(false);
  const roomText = resident.room ? ` · room ${resident.room}` : "";

  return (
    <div className="flex flex-col gap-4 border-t bg-muted/40 px-3 pb-4 pt-3 text-sm">
      {visiting ? (
        <EntryCard
          facilityId={facilityId}
          kind="visit"
          personId={resident.id}
          residentId={resident.id}
          title={`Visit with ${resident.name}${roomText}`}
          alreadyToday={resident.seenToday ? (resident.visitedTodayBy?.length ? resident.visitedTodayBy : ["someone"]) : undefined}
          onDone={onVisitDone}
        />
      ) : null}

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">About them</h3>
        {notes.length === 0 ? (
          <p className="text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {notes.map((n, i) => (
              <li key={i}>
                {n.text} <span className="text-xs text-muted-foreground">· {n.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family</h3>
        {family.length === 0 && !talkingTo ? <p className="mb-2 text-muted-foreground">No family on file.</p> : null}
        <ul className="flex flex-col gap-2">
          {family.map((f) => (
            <li key={f.contactId} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-md border bg-card p-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">{f.relationship}</span>
                </span>
                {f.phone ? (
                  <Button variant="ghost" size="icon" className="size-11 shrink-0" asChild>
                    <a href={`tel:${f.phone}`} aria-label={`Call ${f.name}`}><Phone /></a>
                  </Button>
                ) : null}
                <Button variant="outline" className="h-11 shrink-0" onClick={() => setTalkingTo({ id: f.contactId, name: f.name })}>
                  <MessageCircle /> Talked
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {talkingTo ? (
          <div className="mt-2">
            <EntryCard
              facilityId={facilityId}
              kind="family"
              personId={talkingTo.id}
              residentId={resident.id}
              contactId={talkingTo.id}
              title={`Talked with ${talkingTo.name}, ${resident.name}'s family`}
              onDone={() => setTalkingTo(null)}
            />
          </div>
        ) : addingFamily ? (
          <div className="mt-2">
            <AddPerson
              kind="family"
              facilityId={facilityId}
              residentId={resident.id}
              residentName={resident.name}
              onCancel={() => setAddingFamily(false)}
              // Added (or picked): record the conversation right away.
              onAdded={(person) => {
                setAddingFamily(false);
                setTalkingTo(person);
              }}
            />
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="mt-1 -ml-2 h-11" onClick={() => setAddingFamily(true)}>
            <Plus /> Add a family member
          </Button>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visiting ? null : (
          <Button className="h-11" onClick={onVisit}><HandHeart /> Visit</Button>
        )}
        <Button variant="outline" className="h-11" asChild>
          <Link href={`/tasks/new?facility=${facilityId}&resident=${resident.id}&from=onsite`}>
            <ListChecks /> Follow-up{resident.openTasks ? ` (${resident.openTasks} open)` : ""}
          </Link>
        </Button>
        <Button variant="ghost" className="h-11" asChild>
          <Link href={`/residents/${resident.id}`}><UserRound /> Full profile</Link>
        </Button>
      </div>
    </div>
  );
}
